import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getSydneyNow } from '../utils/businessStatus';

async function sendTelegramCancellationNotification(booking) {
  const botToken = process.env.REACT_APP_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.REACT_APP_TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) return;

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: [
        'Oxford Barber booking cancelled by customer',
        `Name: ${booking.customerName || 'No name'}`,
        `Phone: ${booking.phone || 'No phone'}`,
        `Service: ${booking.serviceName || 'No service'}`,
        `Date: ${booking.bookingDate || 'No date'}`,
        `Time: ${booking.bookingTime || 'No time'}`,
        'Status: cancelled',
      ].join('\n'),
    }),
  });

  if (!response.ok) {
    throw new Error('Telegram cancellation notification failed');
  }
}

export default function CancelBooking() {
  const CANCELLATION_WINDOW_MS = 3 * 60 * 60 * 1000;
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCancelBooking = async (event) => {
    event.preventDefault();

    if (isSubmitting) return;
    if (!phone.trim()) return setErrorMessage('Please enter your phone number.');
    if (!bookingDate) return setErrorMessage('Please enter your booking date.');
    if (!bookingTime) return setErrorMessage('Please enter your booking time.');

    try {
      setIsSubmitting(true);
      setErrorMessage('');
      setMessage('');

      const cancellationQuery = query(
        collection(db, 'bookings'),
        where('phone', '==', phone.trim()),
        where('bookingDate', '==', bookingDate),
        where('bookingTime', '==', bookingTime)
      );

      const snapshot = await getDocs(cancellationQuery);

      if (snapshot.empty) {
        setErrorMessage(
          'No booking was found for that phone number, date, and time.'
        );
        return;
      }

      const bookingDoc =
        snapshot.docs.find((item) => item.data().status !== 'cancelled') ||
        snapshot.docs[0];
      const booking = bookingDoc.data();
      const createdAtMs = new Date(booking.createdAt).getTime();

      if (!createdAtMs || getSydneyNow().getTime() - createdAtMs > CANCELLATION_WINDOW_MS) {
        setErrorMessage(
          'Cancellation is no longer allowed after 3 hours from booking creation.'
        );
        return;
      }

      if (booking.status === 'cancelled') {
        setErrorMessage('This booking has already been cancelled.');
        return;
      }

      await updateDoc(doc(db, 'bookings', bookingDoc.id), {
        status: 'cancelled',
      });

      await sendTelegramCancellationNotification({
        ...booking,
        status: 'cancelled',
      });

      setMessage('Your booking has been cancelled successfully.');
      setPhone('');
      setBookingDate('');
      setBookingTime('');
    } catch (error) {
      console.error('Error cancelling booking:', error);
      setErrorMessage('Something went wrong while cancelling your booking.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, #1a1a1a 0%, #0b0b0b 45%, #050505 100%)',
        color: '#FFFFFF',
        fontFamily: "'Inter', sans-serif",
        padding: '36px 20px 60px',
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Cinzel:wght@600;700;800&display=swap"
        rel="stylesheet"
      />

      <style>{`
        .cancel-shell,
        .cancel-card,
        .cancel-grid,
        .cancel-field,
        .cancel-actions {
          min-width: 0;
          box-sizing: border-box;
        }

        @media (max-width: 768px) {
          .cancel-card {
            padding: 22px !important;
          }

          .cancel-grid {
            grid-template-columns: 1fr !important;
          }

          .cancel-actions button {
            width: 100%;
          }
        }
      `}</style>

      <div className="cancel-shell" style={{ maxWidth: '760px', margin: '0 auto', width: '100%', minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            marginBottom: '28px',
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              background: 'transparent',
              color: '#C6A15B',
              border: '1px solid rgba(198,161,91,0.28)',
              borderRadius: '999px',
              padding: '12px 18px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            &larr; Back Home
          </button>

          <div
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: '1.8rem',
              fontWeight: 800,
            }}
          >
            Cancel <span style={{ color: '#C6A15B' }}>Booking</span>
          </div>
        </div>

        <div
          className="cancel-card"
          style={{
            background:
              'linear-gradient(180deg, rgba(18,18,18,0.96) 0%, rgba(10,10,10,0.98) 100%)',
            border: '1px solid rgba(198,161,91,0.14)',
            borderRadius: '28px',
            padding: '28px',
          }}
        >
          <div
            style={{
              color: '#C6A15B',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              fontSize: '0.8rem',
              fontWeight: 700,
              marginBottom: '12px',
            }}
          >
            Booking Cancellation
          </div>

          <h1
            style={{
              fontSize: '2.1rem',
              margin: '0 0 12px',
              fontWeight: 800,
            }}
          >
            Cancel your booking
          </h1>

          <p
            style={{
              color: '#A8A8A8',
              lineHeight: 1.7,
              marginBottom: '24px',
            }}
          >
            Enter your phone number, booking date, and booking time to cancel your booking request.
          </p>

          {errorMessage && (
            <div
              style={{
                background: 'rgba(255,90,90,0.08)',
                border: '1px solid rgba(255,90,90,0.22)',
                color: '#FF8E8E',
                borderRadius: '18px',
                padding: '14px 16px',
                marginBottom: '18px',
                fontWeight: 600,
              }}
            >
              {errorMessage}
            </div>
          )}

          {message && (
            <div
              style={{
                background: 'rgba(88,224,141,0.08)',
                border: '1px solid rgba(88,224,141,0.22)',
                color: '#9BF0B9',
                borderRadius: '18px',
                padding: '14px 16px',
                marginBottom: '18px',
                fontWeight: 600,
              }}
            >
              {message}
            </div>
          )}

          <form onSubmit={handleCancelBooking}>
            <div className="cancel-field" style={{ marginBottom: '20px', width: '100%', minWidth: 0 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '10px',
                  fontWeight: 700,
                  color: '#DADADA',
                }}
              >
                Phone Number
              </label>

              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Enter your phone number"
                style={{
                  width: '100%',
                  background: '#121212',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '16px',
                  padding: '15px 16px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div
              className="cancel-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '20px',
              }}
            >
              <div className="cancel-field" style={{ width: '100%', minWidth: 0 }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontWeight: 700,
                    color: '#DADADA',
                  }}
                >
                  Booking Date
                </label>

                <input
                  type="date"
                  value={bookingDate}
                  onChange={(event) => setBookingDate(event.target.value)}
                  style={{
                    width: '100%',
                    background: '#121212',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '16px',
                    padding: '15px 16px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div className="cancel-field" style={{ width: '100%', minWidth: 0 }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontWeight: 700,
                    color: '#DADADA',
                  }}
                >
                  Booking Time
                </label>

                <input
                  type="time"
                  value={bookingTime}
                  onChange={(event) => setBookingTime(event.target.value)}
                  style={{
                    width: '100%',
                    background: '#121212',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '16px',
                    padding: '15px 16px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div className="cancel-actions" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  background:
                    'linear-gradient(135deg, #D4AF37 0%, #C6A15B 55%, #B88B2A 100%)',
                  color: '#0B0B0B',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '14px 24px',
                  fontWeight: 800,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? 'Cancelling...' : 'Cancel Booking'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
