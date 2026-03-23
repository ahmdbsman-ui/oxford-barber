export const ALLOWED_ADMIN_EMAILS = [
  '629ahmdbsman@gmail.com',
  'basmanaljumayli51@gmail.com',
];

export function isAllowedAdminEmail(email) {
  return ALLOWED_ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}
