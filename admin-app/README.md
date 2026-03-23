# Oxford Barber Admin App

This folder is the foundation for the separate owner-only admin app.

Why this direction:
- It stays separate from the existing website admin panel.
- It uses the same Firebase project as the website.
- It is prepared for Capacitor, which is the better long-term path for owner mobile usage and native notifications.

Shared backend:
- The website keeps using `src/firebase/config.js`.
- The admin app imports the same Firebase source of truth through `admin-app/vite.config.js`, which aliases `../src/firebase/shared.js`.

Suggested next steps:
1. Install dependencies inside `admin-app`.
2. Run `npm run dev` inside `admin-app`.
3. Add Capacitor platforms and native notification support.
4. Move the placeholder sections into full feature modules one by one.
