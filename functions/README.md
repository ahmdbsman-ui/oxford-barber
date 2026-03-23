Functions folder for backend-only SMS notifications.

Deploy this folder with Firebase Cloud Functions.

Required secrets:
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_FROM_NUMBER

Frontend env var:
- REACT_APP_SMS_APPROVAL_FUNCTION_URL

Example function URL after deploy:
- https://<region>-<project-id>.cloudfunctions.net/sendBookingApprovedSms

Reminder SMS is not wired yet, but the shared message builder structure is already prepared in `index.js`.
