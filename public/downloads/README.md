Place the final Admin App APK in this folder when you want the website to serve it directly.

Recommended filename:
- oxford-barber-admin.apk

Recommended website env var:
- REACT_APP_ADMIN_APP_DOWNLOAD_URL=/downloads/oxford-barber-admin.apk

Notes:
- Files inside public/ are copied as-is into the production build.
- For Netlify, this means the APK will be available at /downloads/oxford-barber-admin.apk.
- If the APK becomes too large for your hosting workflow, keep the same Admin.js section and point
  REACT_APP_ADMIN_APP_DOWNLOAD_URL to a safer external file host instead.
