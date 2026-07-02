# Project Glossary & AI Assistant Domain Rules

This glossary defines standard business and technical terms used in the Gym Management System. The AI assistant and coding components must adhere to these definitions to ensure consistency.

---

## 1. Terminology Definitions

### Membership Statuses
- **Active**: A member whose membership plan duration is current, and who is not in a frozen period (`today <= expiry_date`).
- **Expired**: A member whose plan has run out (`today > expiry_date`).
- **Frozen**: A member whose membership countdown is temporarily paused. The physical check-in will deny them, but their expiry date is pushed forward when unfrozen.
- **Trial / Guest**: A temporary one-day access pass that does not require plan assignment or biometric registration.

### Financial Terms
- **Revenue**: The sum of all payments logged in the `payments` table during a specified timeframe.
- **Expenses**: The sum of all costs logged in the `expenses` table during a specified timeframe.
- **Net Profit (or Profit/Net)**: Calculated strictly as: `Revenue - Expenses`. Do not approximate or confuse net profit with raw revenue.
- **Turnover**: Synonymous with Revenue. If a user asks for "turnover", map it to the sum of payments.
- **Maintenance**: A distinct category under `expenses`. This includes AC servicing, cleaning, repairs, and general facilities maintenance. It is separate from buying new `equipment`.

---

## 2. Default Logic & Parameters

- **"About to end" / "Expiring soon"**:
  - Default duration: **7 days** (i.e., members expiring between `today` and `today + 7 days`).
  - If the owner asks "Who is expiring?", the system defaults to 7 days, and the AI response must explicitly state this assumption (e.g., *"Showing members whose plans expire in the next 7 days:"*).
- **Duplicate-Scan window**:
  - Default duration: **2 minutes**.
  - Consecutive scans of the same biometric credential or RFID card within this window are flagged as duplicate scans rather than logging distinct check-ins.
- **Auto-Backup policy**:
  - Default frequency: Weekly or upon startup/shutdown.
  - Keep limit: **30 backups**. Delete older SQLite backups automatically.
- **Export reminder threshold**:
  - Prompt the owner to perform a manual export if they have not exported data in the last **30 days**.
