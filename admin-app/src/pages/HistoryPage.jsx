export default function HistoryPage({ bookings }) {
  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-kicker">Booking History</div>
        <h1>Past booking activity</h1>
        <p className="panel-copy">
          Completed, cancelled, and older bookings are shown here to keep the
          active bookings screen focused on current appointments.
        </p>
      </section>

      <section className="panel">
        <div className="history-list">
          {bookings.length === 0 ? (
            <div className="message">No booking history yet.</div>
          ) : (
            bookings.map((booking) => (
              <div className="history-row" key={booking.id}>
                <div className="history-main">
                  <strong>{booking.customerName || 'Unnamed customer'}</strong>
                  <span>{booking.serviceName || 'Service not set'}</span>
                </div>
                <span>{booking.bookingDate || 'No date'}</span>
                <span>{booking.bookingTime || 'No time'}</span>
                <span>{booking.phone || 'No phone'}</span>
                <span
                  className={`history-status history-status-${
                    booking.status || 'pending'
                  }`}
                >
                  {booking.status || 'pending'}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
