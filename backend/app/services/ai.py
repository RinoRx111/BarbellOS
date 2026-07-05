import json
import httpx
from datetime import date
from typing import List, Dict, Any, Tuple
from sqlmodel import Session, select
from app.services.ai_config import get_ai_config
from app.services import ai_tools
from app.models import ChatMessage, Member, Plan, GymSettings

# Pending actions store for validation
PENDING_ACTIONS: Dict[str, Dict[str, Any]] = {}

# System prompt assembly
def build_system_prompt(session: Session) -> str:
    today_str = date.today().isoformat()
    gym = session.exec(select(GymSettings)).first()
    gym_name = gym.gym_name if gym else "BarbellOS"
    
    # Load all plans to supply as context for name & ID resolution
    plans = session.exec(select(Plan)).all()
    plans_context = "\n".join([f"- ID: {p.id}, Name: {p.name}, Price: INR {p.price}, Duration: {p.duration_days} days" for p in plans])
    
    return f"""You are the AI assistant for "{gym_name}", a local BarbellOS deployment. Today's date is {today_str}.
    
    You have direct read-only access to the gym data via tools.
    You can propose write operations (members registration, plan renewals, freezes) which will be sent to the owner for approval.
    
    Use the following current data context to resolve names, plans, and parameters:
    
    ### Available plans:
    {plans_context}
    
    CRITICAL RULES:
    1. If the owner asks to perform a WRITE action (e.g. freeze, log payment, add member), you MUST call the corresponding tool. Do NOT confirm the action in plain text. Propose it via the tool call so the system renders a Confirmation Card.
    2. If the owner refers to a member by name, look up their details via read-only tools to find their ID. If there is ambiguity (multiple members matching), do NOT make a tool call; instead ask the owner to clarify which member they mean by name/phone.
    3. If time windows are undefined, default to 7 days (e.g. "Who is expiring?" -> look up next 7 days).
    4. Speak concisely.
    """


# Tool schemas definition
AI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_revenue_summary",
            "description": "Calculate total gym revenue (payments collected) between start_date and end_date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": { "type": "string", "description": "Start date in YYYY-MM-DD format" },
                    "end_date": { "type": "string", "description": "End date in YYYY-MM-DD format" }
                },
                "required": ["start_date", "end_date"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_expenses_summary",
            "description": "Calculate total gym expenses logged between start_date and end_date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": { "type": "string", "description": "Start date in YYYY-MM-DD format" },
                    "end_date": { "type": "string", "description": "End date in YYYY-MM-DD format" }
                },
                "required": ["start_date", "end_date"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_active_members",
            "description": "Get total count of currently active and enrolled members.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_expiring_members",
            "description": "Get list of active members whose plans are expiring in the next N days. Default to 7 days.",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": { "type": "integer", "description": "Number of days ahead to look, defaults to 7" }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_attendance_trend",
            "description": "Get check-in attendance stats (granted vs denied) per day for the last N days (for charts).",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": { "type": "integer", "description": "Number of days of history, defaults to 7" }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "freeze_member",
            "description": "Propose freezing a member's account. This stops countdown and shifts their plan expiry date. REQUIRES confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "member_id": { "type": "integer", "description": "ID of the member to freeze" },
                    "frozen_from": { "type": "string", "description": "Freeze start date YYYY-MM-DD" },
                    "frozen_until": { "type": "string", "description": "Freeze end date YYYY-MM-DD" }
                },
                "required": ["member_id", "frozen_from", "frozen_until"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "log_payment",
            "description": "Propose recording a payment for plan renewal, pushing expiry forward. REQUIRES confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "member_id": { "type": "integer", "description": "Member ID" },
                    "plan_id": { "type": "integer", "description": "Plan ID to purchase/renew" },
                    "amount": { "type": "number", "description": "Amount collected in INR" },
                    "method": { "type": "string", "enum": ["cash", "upi", "card"], "description": "Payment method" }
                },
                "required": ["member_id", "plan_id", "amount", "method"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "add_member",
            "description": "Propose registering a new member. REQUIRES confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": { "type": "string", "description": "Full name" },
                    "phone": { "type": "string", "description": "Phone number" },
                    "plan_id": { "type": "integer", "description": "Initial membership plan ID" },
                    "join_date": { "type": "string", "description": "Join date YYYY-MM-DD" },
                    "email": { "type": "string", "description": "Optional email address" }
                },
                "required": ["name", "phone", "plan_id", "join_date"]
            }
        }
    }
]

def get_provider_details(config: dict) -> Tuple[str, str, Dict[str, str]]:
    provider = config.get("provider", "groq")
    
    if provider == "openai":
        url = "https://api.openai.com/v1/chat/completions"
        model = "gpt-4o-mini"
        headers = {
            "Authorization": f"Bearer {config.get('openai_key')}",
            "Content-Type": "application/json"
        }
    elif provider == "custom":  # Ollama
        url = f"{config.get('ollama_url', 'http://localhost:11434').rstrip('/')}/v1/chat/completions"
        model = "llama3"
        headers = {
            "Content-Type": "application/json"
        }
    elif provider == "anthropic":
        raise ValueError("Anthropic provider is not supported.")
    else:  # Default to Groq
        url = "https://api.groq.com/openai/v1/chat/completions"
        model = "openai/gpt-oss-120b"
        headers = {
            "Authorization": f"Bearer {config.get('api_key')}",
            "Content-Type": "application/json"
        }
        
    return "openai_like", url, headers


async def call_llm(session: Session, user_message: str, session_id: int) -> Dict[str, Any]:
    config = get_ai_config()
    provider_type, url, headers = get_provider_details(config)
    executed_tools = []
    
    # 1. Fetch recent conversation history for this session (last 10 messages)
    history_logs = session.exec(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
    ).all()
    history_logs = list(reversed(history_logs))

    
    messages = [{"role": "system", "content": build_system_prompt(session)}]
    for h in history_logs:
        messages.append({"role": h.role, "content": h.content})
        
    # Append the new user message
    messages.append({"role": "user", "content": user_message})
    
    # 2. Call LLM (loop for handling tool callbacks)
    async with httpx.AsyncClient() as client:
        for _ in range(5):  # Limit tool execution turns to prevent infinite loops
            # Call completions
            if provider_type == "openai_like":
                model_name = config.get("model_name") or ("llama3" if config.get("provider") == "custom" else ("gpt-4o-mini" if config.get("provider") == "openai" else "openai/gpt-oss-120b"))
                payload = {
                    "model": model_name,
                    "messages": messages,
                    "tools": AI_TOOLS,
                    "tool_choice": "auto"
                }
            else:  # Anthropic handler
                payload = {
                    "model": "claude-3-5-sonnet-20240620",
                    "max_tokens": 1024,
                    "messages": [m for m in messages if m["role"] != "system"],
                    "system": messages[0]["content"]
                }
                
            try:
                response = await client.post(url, headers=headers, json=payload, timeout=20.0)
                if response.status_code != 200:
                    return {"status": "error", "message": f"LLM provider error: {response.text}"}
                    
                res_data = response.json()
            except Exception as e:
                return {"status": "error", "message": f"HTTP request failed: {str(e)}"}
                
            choice = res_data.get("choices", [{}])[0]
            msg = choice.get("message", {})
            content = msg.get("content")
            tool_calls = msg.get("tool_calls")
            
            # Save assistant message to history if it returns text and no tools
            if not tool_calls:
                return {
                    "status": "text",
                    "content": content or "I couldn't process that query.",
                    "executed_tools": executed_tools
                }
                
            # Check if any write tools exist in the list.
            # If so, handle the first write tool found for user confirmation.
            write_tools = {"freeze_member", "log_payment", "add_member"}
            write_tool_call = None
            for tc in tool_calls:
                if tc["function"]["name"] in write_tools:
                    write_tool_call = tc
                    break
                    
            if write_tool_call:
                func_name = write_tool_call["function"]["name"]
                executed_tools.append(func_name)
                func_args = json.loads(write_tool_call["function"]["arguments"])
                import secrets
                confirm_id = secrets.token_hex(16)
                PENDING_ACTIONS[confirm_id] = {
                    "action": func_name,
                    "params": func_args,
                    "tool_call_id": write_tool_call["id"]
                }
                return {
                    "status": "requires_confirmation",
                    "action": func_name,
                    "params": func_args,
                    "confirm_id": confirm_id,
                    "executed_tools": executed_tools
                }
                
            # Otherwise, all tool calls are read-only. Process all of them.
            executed_results = []
            for tc in tool_calls:
                func_name = tc["function"]["name"]
                executed_tools.append(func_name)
                func_args = json.loads(tc["function"]["arguments"])

                
                tool_result = {}
                if func_name == "get_revenue_summary":
                    tool_result = ai_tools.get_revenue_summary(
                        session,
                        start_date=func_args.get("start_date"),
                        end_date=func_args.get("end_date")
                    )
                elif func_name == "get_expenses_summary":
                    tool_result = ai_tools.get_expenses_summary(
                        session,
                        start_date=func_args.get("start_date"),
                        end_date=func_args.get("end_date")
                    )
                elif func_name == "get_active_members":
                    tool_result = ai_tools.get_active_members(session)
                elif func_name == "get_expiring_members":
                    tool_result = ai_tools.get_expiring_members(
                        session,
                        days=func_args.get("days", 7)
                    )
                elif func_name == "get_attendance_trend":
                    tool_result = ai_tools.get_attendance_trend(
                        session,
                        days=func_args.get("days", 7)
                    )
                executed_results.append((tc, tool_result))
                
            # Append turn assistant message with all tool calls
            messages.append({
                "role": "assistant",
                "content": content,
                "tool_calls": tool_calls
            })
            # Append tool results for each tool call
            for tc, res in executed_results:
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "name": tc["function"]["name"],
                    "content": json.dumps(res)
                })

            
    return {"status": "error", "message": "Max tool calls limit reached."}
