import { useEffect, useMemo, useRef, useState } from 'react';
import { subscribeToBookings } from '../services/bookings';
import {
  getActiveBookings,
  getBookingStats,
  getHistoryBookings,
} from '../utils/bookingSelectors';

export function useBookings(enabled = true) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newBookingNotification, setNewBookingNotification] = useState(null);
  const hasInitializedSnapshot = useRef(false);
  const seenBookingIdsRef = useRef(new Set());

  useEffect(() => {
    if (!enabled) {
      setBookings([]);
      setLoading(false);
      setError('');
      setNewBookingNotification(null);
      hasInitializedSnapshot.current = false;
      seenBookingIdsRef.current = new Set();
      return undefined;
    }

    const unsubscribe = subscribeToBookings(
      (nextBookings) => {
        const nextBookingIds = new Set(nextBookings.map((booking) => booking.id));

        if (!hasInitializedSnapshot.current) {
          seenBookingIdsRef.current = nextBookingIds;
          hasInitializedSnapshot.current = true;
        } else {
          const newlyCreatedBooking = nextBookings.find(
            (booking) => !seenBookingIdsRef.current.has(booking.id)
          );

          if (newlyCreatedBooking) {
            setNewBookingNotification({
              id: newlyCreatedBooking.id,
              customerName: newlyCreatedBooking.customerName || 'Unnamed customer',
              serviceName: newlyCreatedBooking.serviceName || 'Service not set',
              bookingDate: newlyCreatedBooking.bookingDate || 'No date',
              bookingTime: newlyCreatedBooking.bookingTime || 'No time',
            });
          }

          seenBookingIdsRef.current = nextBookingIds;
        }

        setBookings(nextBookings);
        setLoading(false);
      },
      (nextError) => {
        console.error('Error subscribing to admin app bookings:', {
          code: nextError?.code || 'unknown',
          message: nextError?.message || 'Unknown Firestore error',
          name: nextError?.name || 'FirebaseError',
        });
        setError('Failed to load live bookings.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [enabled]);

  const stats = useMemo(() => {
    return getBookingStats(bookings);
  }, [bookings]);

  const activeBookings = useMemo(() => getActiveBookings(bookings), [bookings]);
  const historyBookings = useMemo(
    () => getHistoryBookings(bookings),
    [bookings]
  );

  const dismissNewBookingNotification = () => {
    setNewBookingNotification(null);
  };

  return {
    activeBookings,
    bookings,
    dismissNewBookingNotification,
    error,
    historyBookings,
    loading,
    newBookingNotification,
    stats,
  };
}
