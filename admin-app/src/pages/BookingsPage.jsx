import BookingCard from '../components/BookingCard';

export default function BookingsPage({
  bookings,
  loading,
  error,
  actionError,
  actionLoadingId,
  onApprove,
  onCancel,
}) {
  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-kicker">Bookings</div>
        <h1>Live bookings list</h1>
        <p className="panel-copy">
          Approve or cancel from the owner app. Firestore updates immediately
          reflect in the website admin as well.
        </p>
      </section>

      {error ? <div className="message error">{error}</div> : null}
      {actionError ? <div className="message error">{actionError}</div> : null}
      {loading ? <div className="message">Loading bookings...</div> : null}

      {!loading && bookings.length === 0 ? (
        <div className="message">No active bookings found.</div>
      ) : null}

      <div className="booking-list">
        {bookings.map((booking) => (
          <BookingCard
            key={booking.id}
            actionLoading={actionLoadingId === booking.id}
            booking={booking}
            onApprove={onApprove}
            onCancel={onCancel}
          />
        ))}
      </div>
    </div>
  );
}
