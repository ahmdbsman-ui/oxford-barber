import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

function getNotificationId(bookingId) {
  let hash = 0;
  const value = String(bookingId || '');

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash) || Date.now();
}

export async function ensureNativeNotificationPermission() {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  const currentPermission = await LocalNotifications.checkPermissions();

  if (currentPermission.display === 'granted') {
    return true;
  }

  const requestedPermission = await LocalNotifications.requestPermissions();

  return requestedPermission.display === 'granted';
}

export async function showNewBookingNativeNotification(booking) {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  const hasPermission = await ensureNativeNotificationPermission();

  if (!hasPermission) {
    return;
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        id: getNotificationId(booking.id),
        title: 'New Oxford Barber booking',
        body: [
          booking.customerName || 'Unnamed customer',
          booking.serviceName || 'Service not set',
          booking.bookingDate || 'No date',
          booking.bookingTime || 'No time',
        ].join(' | '),
        schedule: { at: new Date(Date.now() + 250) },
      },
    ],
  });
}
