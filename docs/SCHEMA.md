# Database Schema Specification

This document contains the canonical table definitions for the Gym Management System. The database is a single SQLite file.

---

## 1. Table Definitions

### `gym_settings` (Single-row configuration)
- `id`: INTEGER (PK)
- `gym_name`: VARCHAR
- `owner_name`: VARCHAR
- `phone`: VARCHAR
- `access_policy`: VARCHAR (`fail_open` | `fail_closed`)

### `admin_users` (Admin authentication)
- `id`: INTEGER (PK)
- `name`: VARCHAR
- `pin_hash`: VARCHAR (bcrypt/argon2 hash of PIN or password)
- `created_at`: DATETIME

### `plans` (Membership tiers)
- `id`: INTEGER (PK)
- `name`: VARCHAR (e.g., "Monthly", "Quarterly", "PT - 12 sessions")
- `duration_days`: INTEGER
- `price`: DECIMAL / FLOAT

### `members` (Gym members)
- `id`: INTEGER (PK)
- `name`: VARCHAR
- `phone`: VARCHAR
- `email`: VARCHAR (nullable)
- `photo_path`: VARCHAR (nullable)
- `plan_id`: INTEGER (FK -> `plans.id`)
- `join_date`: DATE
- `expiry_date`: DATE (computed at signup/renewal as join_date + plan duration)
- `frozen_from`: DATE (nullable)
- `frozen_until`: DATE (nullable)
- `biometric_template_id`: VARCHAR (nullable, pointer to securely stored biometric template)
- `card_id`: VARCHAR (nullable, for RFID card members)
- **Derived Attribute** `status`: Calculated dynamically at query time:
  - `frozen` if `today` falls between `frozen_from` and `frozen_until`.
  - `active` if `today <= expiry_date` (adjusted for any frozen days).
  - `expired` if `today > expiry_date`.
  - *Note: Status must never be stored as a column in the database.*

### `payments` (Payment records)
- `id`: INTEGER (PK)
- `member_id`: INTEGER (FK -> `members.id`)
- `amount`: DECIMAL / FLOAT
- `payment_date`: DATETIME
- `method`: VARCHAR (`cash` | `upi` | `card`)
- `plan_id`: INTEGER (FK -> `plans.id`, indicates which plan this payment purchased/renewed)

### `attendance` (Access control logs)
- `id`: INTEGER (PK)
- `member_id`: INTEGER (FK -> `members.id`)
- `check_in_time`: DATETIME
- `check_in_method`: VARCHAR (`biometric` | `card` | `manual`)
- `access_granted`: BOOLEAN (Logs both successful check-ins and denials)

### `expenses` (Business costs)
- `id`: INTEGER (PK)
- `category`: VARCHAR (`rent` | `equipment` | `salary` | `utilities` | `maintenance` | `other`)
- `amount`: DECIMAL / FLOAT
- `date`: DATE
- `note`: VARCHAR (nullable)

---

## 2. Integrity Rules
- **No Foreign Key for Gym**: As a single-tenant system, do not include `gym_id` fields.
- **Biometric Storage**: Only biometric template IDs/pointers should be stored in the database. Never store raw biometric data (like fingerprint images) in the database.
