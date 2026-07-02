# UI/UX Brief & Design System

This brief outlines the visual theme, component behaviors, page layouts, and micro-interactions designed to make the Gym Management System interface feel premium, responsive, and state-of-the-art.

---

## 1. Visual Design System

To ensure a high-end, premium aesthetic, the interface will adopt a dark-mode-first, glassmorphism design language with high-contrast color alerts.

### Color Palette

| Name | Hex Value | Purpose |
|---|---|---|
| **Background Dark** | `#0B0F19` | Main application background (sleek deep slate/navy) |
| **Surface Dark** | `#161D30` | Container and card background (semitransparent glassmorphism) |
| **Accent Primary** | `#3B82F6` | Primary action buttons, selection indicators (Electric Blue) |
| **Accent Success** | `#10B981` | Active members, check-in granted, online status (Emerald Green) |
| **Accent Danger** | `#EF4444` | Expired members, check-in denied, offline status (Crimson Red) |
| **Accent Warning** | `#F59E0B` | Frozen memberships, duplicate check-ins (Amber Gold) |
| **Text Primary** | `#F8FAFC` | Main headings and active text |
| **Text Secondary** | `#94A3B8` | Subtext, labels, and captions |

### Typography
- **Primary Font**: `Outfit` or `Inter` via Google Fonts (clean, modern sans-serif).
- **Scale**:
  - Main Dashboard Value: `2.5rem` (bold)
  - Card Headings: `1.1rem` (semibold)
  - Body Text: `0.9rem` (regular)
  - Labels & Badges: `0.75rem` (uppercase, bold)

### Glassmorphism Treatment
Containers (cards, panels, modals) will use:
- **Background**: `rgba(22, 29, 48, 0.7)`
- **Blur**: `backdrop-filter: blur(12px)`
- **Border**: `1px solid rgba(255, 255, 255, 0.08)`
- **Shadow**: `0 8px 32px 0 rgba(0, 0, 0, 0.37)`

---

## 2. Layout Structure

The desktop app screen is split into a multi-panel layout designed to keep vital metrics and live entry logs visible at all times.

```
+-----------------------------------------------------------------------------------+
|  [H] Header: Gym Name  |  Reader: [ONLINE]  |  Door: [LOCKED]   [MANUAL OVERRIDE]  |
+---------------------+-----------------------------------------------+-------------+
|                     |                                               |             |
|  [S] Navigation     |  [M] Main Content Window                      |  [A] AI     |
|  - Dashboard        |                                               |      Chat   |
|  - Members          |  * Displays active view                       |      Drawer |
|  - Payments         |  * Scrollable grid/table                      |             |
|  - Expenses         |                                               |  (Slides    |
|  - Settings         |                                               |   in/out    |
|                     |                                               |   from the  |
|                     |                                               |   right)    |
|                     |                                               |             |
+---------------------+-----------------------------------------------+-------------+
|  [F] Status Bar: DB Connected | SQLite Backed | v1.0.0                            |
+-----------------------------------------------------------------------------------+
```

### Layout Elements:
1. **Header Bar**:
   - Gym branding on the left.
   - Hardware status monitors in the center (visual indicators of biometric reader and lock relay status).
   - **Manual Door Override Button**: Primary action button. Clicking it pulses green and sends a command to unlock the door for 5 seconds.
2. **Sidebar Navigation**:
   - Vertical list of modules. Icon + text. Active state shows an electric blue left border and a soft glow background.
3. **Main Content Window**:
   - Dynamically loaded component view. Uses transitions when switching pages.
4. **AI Chat Drawer**:
   - Floating sidebar panel on the right. Can be toggled open/close via keyboard shortcut or a persistent icon button in the header.

---

## 3. Core Interactive Components

### A. Live Attendance Feed Card
As members scan in at the physical gate, cards push down a real-time list on the Dashboard.

- **Granted Card**:
  - Green outline glow.
  - Avatar, member name, plan type, timestamp.
  - "GRANTED" badge in emerald green.
- **Denied Card**:
  - Red outline glow (pulses once on arrival).
  - Unrecognized card/fingerprint displays a generic silhouette and "UNKNOWN GUEST" label.
  - Denied reason printed clearly: `"Expired Plan (Ended 2 days ago)"` or `"Membership Frozen"`.
- **Duplicate scan indicator**:
  - Amber badge: `"DUPLICATE SCAN (2m)"`.

### B. Biometric Enrollment Widget
A visual wizard within the Member onboarding flow to replace dry text logs.

- Shows a graphic representation of a fingerprint scanner.
- Progress indicated by three circular steps:
  1. `[○]` First Scan (Waiting...)
  2. `[●]` Second Scan (Place finger again...)
  3. `[●]` Third Scan (Processing...)
- Success state triggers a checkmark transition with a scale bounce animation.

### C. AI Assistant Confirmation Card
Renders in the chat drawer when the LLM suggests a database update.

- **Layout**: Dark gray inset box with a subtle amber warning outline.
- **Content**:
  - Plain English description of the action: *"Log a cash payment of ₹1,500 for Rahul Sharma and renew the Monthly Plan?"*
- **Action Buttons**:
  - Left button: `Cancel` (flat style).
  - Right button: `Confirm Action` (electric blue fill, triggers loading indicator on click).

---

## 4. Micro-interactions & Visual Polish

- **State Transitions**: All hoverable list elements, buttons, and drawer tabs should use `transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)`.
- **Active Indicators**: Active reader status should have a CSS radial pulsing animation (`animation: pulse 2s infinite`).
- **Beep Sounds**: The dashboard UI plays short synthesized high-pitch tones (`200ms`) for manual grants, and a double low-pitch beep for manual denies, mimicking physical hardware feedback. Can be toggled off in settings.
