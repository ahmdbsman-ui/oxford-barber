import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useBookings } from './hooks/useBookings';
import { useAdminAuth } from './hooks/useAdminAuth';
import OwnerShell from './components/OwnerShell';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardPage from './pages/DashboardPage';
import BookingsPage from './pages/BookingsPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import BannedUsersPage from './pages/BannedUsersPage';
import GalleryPage from './pages/GalleryPage';
import ReviewsPage from './pages/ReviewsPage';
import LoginPage from './pages/LoginPage';
import {
  deleteBooking,
  runSharedBookingStatusAction,
} from './services/bookings';

export default function App() {
  const {
    authError,
    authReady,
    currentUser,
    firestoreReady,
    isAuthenticatedAdmin,
    login,
    logout,
  } = useAdminAuth();
  const {
    activeBookings,
    bookings,
    dismissNewBookingNotification,
    error,
    historyBookings,
    loading,
    newBookingNotification,
    stats,
  } = useBookings(
    authReady && firestoreReady && isAuthenticatedAdmin && Boolean(currentUser)
  );
  const [actionError, setActionError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState('');

  useEffect(() => {
    if (!newBookingNotification) return undefined;

    const timeoutId = window.setTimeout(() => {
      dismissNewBookingNotification();
    }, 6000);

    return () => window.clearTimeout(timeoutId);
  }, [dismissNewBookingNotification, newBookingNotification]);

  const runBookingAction = async (bookingId, action) => {
    try {
      setActionError('');
      setActionLoadingId(bookingId);
      await action();
    } catch (nextError) {
      console.error('Admin app booking action failed:', nextError);
      setActionError('Booking action failed. Please try again.');
    } finally {
      setActionLoadingId('');
    }
  };

  const handleApprove = async (bookingId) => {
    const booking = bookings.find((item) => item.id === bookingId);
    await runBookingAction(bookingId, () =>
      runSharedBookingStatusAction(bookingId, 'confirmed', booking)
    );
  };

  const handleCancel = async (bookingId) => {
    const booking = bookings.find((item) => item.id === bookingId);
    await runBookingAction(bookingId, () =>
      runSharedBookingStatusAction(bookingId, 'cancelled', booking)
    );
  };

  const handleDelete = async (bookingId) => {
    await runBookingAction(bookingId, () => deleteBooking(bookingId));
  };

  return (
    <Routes>
      <Route
        element={
          <ProtectedRoute
            authReady={authReady}
            isAuthenticatedAdmin={isAuthenticatedAdmin}
          />
        }
      >
        <Route
          element={
            <OwnerShell
              currentUser={currentUser}
              newBookingNotification={newBookingNotification}
              onDismissNotification={dismissNewBookingNotification}
              onLogout={logout}
            />
          }
        >
          <Route
            path="/"
            element={<DashboardPage bookings={bookings} stats={stats} />}
          />
          <Route
            path="/bookings"
            element={
              <BookingsPage
                actionError={actionError}
                actionLoadingId={actionLoadingId}
                bookings={activeBookings}
                error={error}
                loading={loading}
                onApprove={handleApprove}
                onCancel={handleCancel}
                onDelete={handleDelete}
              />
            }
          />
          <Route
            path="/history"
            element={<HistoryPage bookings={historyBookings} />}
          />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/banned-users" element={<BannedUsersPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
        </Route>
      </Route>
      <Route
        path="/login"
        element={
          <LoginPage
            authError={authError}
            isAuthenticatedAdmin={isAuthenticatedAdmin}
            login={login}
          />
        }
      />
      <Route
        path="*"
        element={<Navigate replace to={isAuthenticatedAdmin ? '/' : '/login'} />}
      />
    </Routes>
  );
}
