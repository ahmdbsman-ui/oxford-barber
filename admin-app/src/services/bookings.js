import {
  collection,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { runBookingAdminAction } from './bookingActions';

function getCreatedAtTime(createdAt) {
  if (!createdAt) return Number.NEGATIVE_INFINITY;

  if (typeof createdAt?.toDate === 'function') {
    const timestampDate = createdAt.toDate();
    const timestampValue = timestampDate instanceof Date ? timestampDate.getTime() : NaN;
    return Number.isFinite(timestampValue) ? timestampValue : Number.NEGATIVE_INFINITY;
  }

  if (createdAt instanceof Date) {
    const dateValue = createdAt.getTime();
    return Number.isFinite(dateValue) ? dateValue : Number.NEGATIVE_INFINITY;
  }

  if (typeof createdAt === 'string') {
    const parsedValue = Date.parse(createdAt);
    return Number.isFinite(parsedValue) ? parsedValue : Number.NEGATIVE_INFINITY;
  }

  if (typeof createdAt === 'number') {
    return Number.isFinite(createdAt) ? createdAt : Number.NEGATIVE_INFINITY;
  }

  return Number.NEGATIVE_INFINITY;
}

function sortBookingsNewestFirst(bookings) {
  return [...bookings].sort((left, right) => {
    const rightValue = getCreatedAtTime(right.createdAt);
    const leftValue = getCreatedAtTime(left.createdAt);

    if (rightValue !== leftValue) {
      return rightValue - leftValue;
    }

    return String(right.id || '').localeCompare(String(left.id || ''));
  });
}

export function subscribeToBookings(onData, onError) {
  return onSnapshot(
    collection(db, 'bookings'),
    (snapshot) => {
      const bookings = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

      onData(sortBookingsNewestFirst(bookings));
    },
    (error) => {
      console.error('Admin app bookings subscription failed:', {
        code: error?.code || 'unknown',
        message: error?.message || 'Unknown Firestore error',
        name: error?.name || 'FirebaseError',
      });

      if (typeof onError === 'function') {
        onError(error);
      }
    }
  );
}

export async function runSharedBookingStatusAction(bookingId, status, booking) {
  const action = status === 'confirmed' ? 'approve' : 'cancel';
  await runBookingAdminAction(action, bookingId, booking);
}

export async function updateBookingStatus(bookingId, status, booking) {
  await runSharedBookingStatusAction(bookingId, status, booking);
}
