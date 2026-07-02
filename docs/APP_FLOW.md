# Application Flow Specification

This document details the step-by-step user journeys and backend execution flows for key actions in the Gym Management System.

---

## 1. Startup & Authentication Flow

```mermaid
graph TD
    A[Launch App] --> B[Electron Spawns FastAPI Backend]
    B --> C{Check SQLite DB Setup}
    C -- Empty DB / No Settings --> D[Show Setup Onboarding Screen]
    C -- Settings Exist --> E[Show PIN Lock Screen]
    D --> F[Submit Onboarding Form]
    F --> G[Initialize Settings & Admin PIN]
    G --> H[Redirect to Dashboard]
    E --> I[Enter PIN]
    I --> J{Validate bcrypt hash}
    J -- Invalid PIN --> K[Show Error Message]
    J -- Valid PIN --> H
```

### Steps:
1. **Initialization**: Electron starts up, runs PyInstaller's backend binary on a dynamically selected local port, and loads the React UI.
2. **Onboarding (First-time launch)**:
   - Prompt the user to enter Gym Name, Owner Name, Contact Phone, PIN code, and Access Policy.
   - Must present the **Biometric Consent Policy** statement for review.
3. **Authentication**:
   - Admin enters the PIN code. The client sends it to the backend for verification using `bcrypt` comparison.
   - Upon successful verification, the app sets a client-side session flag (unlocked state).

---

## 2. Member Onboarding & Biometric Enrollment Flow

```mermaid
graph TD
    A[Navigate to Members] --> B[Click 'Add Member']
    B --> C[Fill details: Name, Phone, Plan]
    C --> D{Capture Fingerprint/Card?}
    D -- Card ID --> E[Input Card ID manually or scan RFID]
    D -- Biometric --> F[Check Biometric Consent Checkbox]
    F -- Checked --> G[Click 'Start Enrollment']
    G --> H[FastAPI tells Reader to enter enrollment mode]
    H --> I[Member scans finger 3 times on reader]
    I --> J[Reader generates Template ID]
    J --> K[FastAPI returns Template ID to Frontend]
    D -- Skip --> L[Save Member Details]
    E --> L
    K --> L
    L --> M[Log Initial Payment Form]
    M --> N[Save to DB & Compute Expiry Date]
```

### Steps:
1. **Consent Gate**: The "Start Enrollment" button remains disabled until the operator checks the "Biometric Consent Given" checkbox (mandatory under India DPDP Act compliance).
2. **Device Communication**:
   - Frontend sends a request to the backend: `POST /api/hardware/enroll`.
   - The backend puts the ZKTeco/Mantra reader into enrollment mode.
   - The reader prompts the member (via screen/lights) to scan their finger 3 times to construct a template.
3. **Template Assignment**:
   - Once enrolled, the backend saves the numeric biometric template pointer in the reader memory and returns the pointer ID to the frontend.
   - The frontend includes this `biometric_template_id` (or RFID `card_id`) in the member creation payload.

---

## 3. Physical Access Control Flow (Real-time Gate)

This flow is critical and must execute in **under 1 second** to prevent queues at the gym entrance.

```mermaid
graph TD
    A[Member scans finger or card at door] --> B[Reader device generates scan event]
    B --> C[FastAPI listens to reader connection/webhook]
    C --> D[Identify Member by Card ID or Biometric Template ID]
    D --> E{Member found in database?}
    E -- No --> F[Deny Access: Unrecognized scan]
    E -- Yes --> G{Calculate Status dynamically}
    G -- Frozen --> H[Deny Access: Account is frozen]
    G -- Expired --> I[Deny Access: Plan is expired]
    G -- Active --> J{Check Duplicate Scan < 2 mins?}
    J -- Yes --> K[Grant Access, but flag entry as DUPLICATE scan]
    J -- No --> L[Grant Access]
    F & H & I --> M[Log Attendance: access_granted=False]
    M --> N[FastAPI sends Deny command to device: Red Light + Beeps]
    L & K --> O[Log Attendance: access_granted=True]
    O --> P[FastAPI sends Grant command to device: Open Relay + Green Light + Beep]
    M & O --> Q[Broadcast event via WebSocket to Frontend today's entry log]
```

### Steps:
1. **Default Fail-Open**: If the backend, reader, or database connection is offline, the physical hardware defaults to its hardware fail-open state (unlocked).
2. **Duplicate-Scan Flagging**:
   - The system queries recent attendance logs for the member.
   - If an entry exists within the past 2 minutes, it is still allowed through (so members aren't stuck if they scan twice by accident), but flagged in the logs and UI to prevent card sharing.

---

## 4. Membership Freeze & Unfreeze Flow

```mermaid
graph TD
    A[Open Member Profile] --> B[Click 'Freeze Membership']
    B --> C[Input Freeze Start Date & End Date]
    C --> D[Submit Request]
    D --> E[Save frozen_from and frozen_until on Member]
    E --> F[Pushes Expiry Date forward by freeze duration]
```

### Expiry Date Adjustment Math:
- When a freeze is applied, the backend shifts the `expiry_date` forward by `(frozen_until - frozen_from) + 1` days.
- If the freeze is modified or cancelled early, the expiry date is dynamically recalculated to ensure the member only receives credit for the days the membership was actually paused.

---

## 5. AI Assistant Action Authorization Flow

To prevent prompt injection, accidental writes, or incorrect target manipulations:

```mermaid
graph TD
    A[User enters instruction in chat drawer] --> B[API forwards message to LLM provider]
    B --> C{LLM determines intent}
    C -- Read-only Query --> D[Execute tool query]
    D --> E[Format response data / Recharts JSON]
    E --> F[Show response in Chat UI]
    C -- Write Action --> G[LLM returns tool_call with parameters]
    G --> H[Frontend intercepts tool_call]
    H --> I[Render a Confirmation Card in Chat UI]
    I --> J{User clicks 'Confirm' or 'Cancel'}
    J -- Cancel --> K[Discard action, log cancellation in chat history]
    J -- Confirm --> L[Send execution request to FastAPI]
    L --> M[FastAPI executes action using validated DB function]
    M --> N[Log audit trail with 'via: ai' tag]
    N --> O[Refresh current app page data & update chat log]
```
