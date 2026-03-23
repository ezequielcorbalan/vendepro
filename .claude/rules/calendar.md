# Calendar Rules

## Views
- Month: grid with colored event chips, "+N mas" overflow
- Week: 7 columns, 08-20h time slots, positioned blocks (desktop default)
- Day: detailed event list with full info
- Agenda: chronological upcoming list (mobile default)

## Events
- 9 types: llamada, reunion, visita_captacion, visita_comprador, tasacion, seguimiento, admin, firma, otro
- Each has: color, icon, label (centralized in EVENT_TYPES config)
- Must link to: lead, contact, property, appraisal, reservation

## States
- Pending: normal
- Completed: faded + check
- Overdue: red border + amber tint + "VENCIDO" badge
- Cancelled: strikethrough + faded

## Quick Actions
- Complete, Call, WhatsApp, Reschedule, Delete
- Disabled Call/WhatsApp when no phone available
