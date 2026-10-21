# UI Plan

## Visual direction

- A calm, clinical palette of ink navy, clear healthcare blue, white, and restrained teal.
- Use a legible system font stack, compact headings, generous form spacing, and clear focus states.
- Keep public booking actions prominent; keep admin pages dense and task-focused.
- Use a small decorative clinical illustration and CSS shape accents, not dashboard-card-heavy marketing layouts.

## Pages and interactions

- `client/index.html`: public overview, active providers/services, availability and booking/status navigation.
- `client/book.html`: labeled booking form, provider/service and slot loading, validation, pending state, success reference.
- `client/admin-login.html`: administrator sign-in with inline errors and submit feedback.
- `client/admin-dashboard.html`: authenticated summary, search/date/provider/status filters, appointment actions, logout.
- All pages share responsive navigation, footer, notification behavior, and CSS variables from `client/css/style.css`.

## Accessibility and responsive behavior

- Semantic landmarks, explicit labels, status announcements, keyboard-operable controls, and visible focus rings.
- Grid layouts collapse to a single column on narrow screens; the appointment table becomes a scrollable region.
- Disable submission during network work and show API-confirmed success only after a successful response.