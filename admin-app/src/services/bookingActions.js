import { auth } from '../firebase/config';

const defaultBookingActionFunctionUrl =
  'https://australia-southeast1-oxford-barber-ee024.cloudfunctions.net/handleAdminBookingAction';

const bookingActionFunctionUrl =
  import.meta.env.VITE_BOOKING_ACTION_FUNCTION_URL?.trim() ||
  import.meta.env.VITE_BOOKING_ADMIN_ACTION_FUNCTION_URL?.trim() ||
  defaultBookingActionFunctionUrl;

export async function runBookingAdminAction(action, bookingId, booking) {
  if (!bookingActionFunctionUrl) {
    throw new Error('Booking action function URL is not configured.');
  }

  if (!auth.currentUser) {
    throw new Error('You must be signed in to manage bookings.');
  }

  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch(bookingActionFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      action,
      bookingId,
      booking: {
        customerName: booking?.customerName || '',
        phone: booking?.phone || '',
        serviceName: booking?.serviceName || '',
        bookingDate: booking?.bookingDate || '',
        bookingTime: booking?.bookingTime || '',
        queueNumber: booking?.queueNumber || null,
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Booking action request failed.');
  }

  return payload;
}
