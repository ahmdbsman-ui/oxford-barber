export default function BookingCard({
  booking,
  onApprove,
  onCancel,
  onDelete,
  actionLoading,
}) {
  const status = booking.status || 'pending';

  return (
    <article className="booking-card">
      <div className="booking-card-head">
        <div>
          <h3>{booking.customerName || 'Unnamed customer'}</h3>
          <p>
            {booking.serviceName || 'Service not set'} | {booking.bookingDate || 'No date'} |{' '}
            {booking.bookingTime || 'No time'}
          </p>
        </div>

        <span className={`booking-status booking-status-${status}`}>
          {status}
        </span>
      </div>

      <div className="booking-meta-grid">
        <div>
          <span>Phone</span>
          <strong>{booking.phone || 'Not provided'}</strong>
        </div>
        <div>
          <span>Price</span>
          <strong>${Number(booking.price) || 0}</strong>
        </div>
        <div>
          <span>Queue</span>
          <strong>{booking.queueNumber || 'N/A'}</strong>
        </div>
      </div>

      <div className="booking-actions">
        <button
          disabled={actionLoading || status === 'confirmed'}
          onClick={() => onApprove(booking.id)}
          type="button"
        >
          {actionLoading ? 'Please wait...' : 'Approve'}
        </button>
        <button
          className="secondary"
          disabled={actionLoading || status === 'cancelled'}
          onClick={() => onCancel(booking.id)}
          type="button"
        >
          {actionLoading ? 'Please wait...' : 'Cancel'}
        </button>
        <button
          className="danger"
          disabled={actionLoading}
          onClick={() => onDelete(booking.id)}
          type="button"
        >
          {actionLoading ? 'Please wait...' : 'Delete'}
        </button>
      </div>
    </article>
  );
}
