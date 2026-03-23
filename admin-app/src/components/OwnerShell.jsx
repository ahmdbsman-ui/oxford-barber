import { NavLink, Outlet } from 'react-router-dom';

const sections = [
  { label: 'Dashboard', to: '/' },
  { label: 'Bookings', to: '/bookings' },
  { label: 'History', to: '/history' },
  { label: 'Settings', to: '/settings' },
  { label: 'Banned Users', to: '/banned-users' },
  { label: 'Gallery', to: '/gallery' },
  { label: 'Reviews', to: '/reviews' },
];

export default function OwnerShell({
  children,
  currentUser,
  newBookingNotification,
  onDismissNotification,
  onLogout,
}) {
  return (
    <div className="owner-shell">
      <aside className="owner-sidebar">
        <div className="owner-brand">Oxford Barber Admin</div>
        <p className="owner-subtitle">
          Owner-only mobile admin connected to the same live Firebase data.
        </p>

        <div className="owner-user-card">
          <div className="owner-user-email">
            {currentUser?.email || 'Signed in admin'}
          </div>
          <button className="owner-logout-button" onClick={onLogout} type="button">
            Logout
          </button>
        </div>

        <nav className="owner-nav">
          {sections.map((section) => (
            <NavLink
              key={section.to}
              className={({ isActive }) =>
                `owner-nav-link${isActive ? ' active' : ''}`
              }
              to={section.to}
            >
              {section.label}
            </NavLink>
          ))}
        </nav>

        <div className="owner-note">
          Push notifications for new bookings are planned next through Capacitor.
        </div>
      </aside>

      <main className="owner-content">
        {newBookingNotification ? (
          <div className="in-app-toast" role="status">
            <div className="in-app-toast-copy">
              <div className="in-app-toast-kicker">New Booking</div>
              <strong>{newBookingNotification.customerName}</strong>
              <span>
                {newBookingNotification.serviceName} |{' '}
                {newBookingNotification.bookingDate} |{' '}
                {newBookingNotification.bookingTime}
              </span>
            </div>
            <button
              className="in-app-toast-close"
              onClick={onDismissNotification}
              type="button"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {children || <Outlet />}
      </main>
    </div>
  );
}
