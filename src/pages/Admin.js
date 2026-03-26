import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  updateDoc,
  doc,
  deleteDoc,
  getDoc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { auth, db, storage } from '../firebase/config';
import { runBookingAdminAction } from '../firebase/bookingActions';
import { isBusinessToday } from '../utils/businessStatus';

function formatClosureDateRange(closure) {
  if (!closure?.startDate) return 'No date';
  if (!closure?.endDate || closure.startDate === closure.endDate) {
    return closure.startDate;
  }

  return `${closure.startDate} to ${closure.endDate}`;
}

function formatClosureTimeRange(closure) {
  if (closure?.isFullDay) return 'Full day';
  if (!closure?.startTime || !closure?.endTime) return 'Time not set';
  return `${closure.startTime} - ${closure.endTime}`;
}

export default function Admin() {
  const ADMIN_NOTIFICATION_PREFERENCE_KEY =
    'oxfordAdminBrowserNotificationPreference';
  const defaultAdminAppDownloadUrl = '/downloads/oxford-barber-admin.apk';
  const adminAppDownloadUrl = [
    process.env.REACT_APP_ADMIN_APP_DOWNLOAD_URL,
    process.env.REACT_APP_ADMIN_APP_DOWNLOAD_LINK,
  ]
    .map((value) => value?.trim())
    .find(Boolean) || defaultAdminAppDownloadUrl;
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeSection, setActiveSection] = useState('bookings');
  const [settings, setSettings] = useState({
    happyClients: '500+',
    rating: '5.0',
    experience: '8+',
    vacationMode: false,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [bannedUsers, setBannedUsers] = useState([]);
  const [bannedPhone, setBannedPhone] = useState('');
  const [bannedReason, setBannedReason] = useState('');
  const [bannedLoading, setBannedLoading] = useState(false);
  const [bannedMessage, setBannedMessage] = useState('');
  const [reviews, setReviews] = useState([]);
  const [reviewCustomerName, setReviewCustomerName] = useState('');
  const [reviewRating, setReviewRating] = useState('5');
  const [reviewText, setReviewText] = useState('');
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsMessage, setReviewsMessage] = useState('');
  const [galleryItems, setGalleryItems] = useState([]);
  const [galleryImageFile, setGalleryImageFile] = useState(null);
  const [galleryTitle, setGalleryTitle] = useState('');
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryMessage, setGalleryMessage] = useState('');
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [notificationPromptLoading, setNotificationPromptLoading] =
    useState(false);
  const [scheduledClosures, setScheduledClosures] = useState([]);
  const [closuresLoading, setClosuresLoading] = useState(false);
  const [closuresMessage, setClosuresMessage] = useState('');
  const [closureForm, setClosureForm] = useState({
    startDate: '',
    endDate: '',
    isFullDay: true,
    startTime: '',
    endTime: '',
    reason: '',
  });
  const hasInitializedBookingListener = useRef(false);
  const seenBookingIdsRef = useRef(new Set());

  const adminFormGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px',
  };

  const adminFieldStyle = {
    width: '100%',
    minWidth: 0,
  };

  const adminInputStyle = {
    width: '100%',
    background: '#121212',
    color: '#FFFFFF',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '16px',
    padding: '14px 16px',
    fontSize: '1rem',
    boxSizing: 'border-box',
  };

  const adminHelperTextStyle = {
    color: '#A8A8A8',
    marginTop: '8px',
    fontSize: '0.88rem',
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      setBookings(data);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setErrorMessage('Failed to load bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchSettings();
    fetchBannedUsers();
    fetchReviews();
    fetchGalleryItems();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'scheduledClosures'),
      (snapshot) => {
        const data = snapshot.docs
          .map((item) => ({
            id: item.id,
            ...item.data(),
          }))
          .sort((left, right) =>
            `${left.startDate || ''}${left.startTime || ''}`.localeCompare(
              `${right.startDate || ''}${right.startTime || ''}`
            )
          );

        setScheduledClosures(data);
      },
      (error) => {
        console.error('Error listening to scheduled closures:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const bookingsQuery = query(
      collection(db, 'bookings'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        const nextBookings = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setBookings(nextBookings);
        setLoading(false);

        if (!hasInitializedBookingListener.current) {
          snapshot.docs.forEach((item) => {
            seenBookingIdsRef.current.add(item.id);
          });
          hasInitializedBookingListener.current = true;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          if (seenBookingIdsRef.current.has(change.doc.id)) return;

          seenBookingIdsRef.current.add(change.doc.id);

          if (shouldSendBrowserNotifications(ADMIN_NOTIFICATION_PREFERENCE_KEY)) {
            showNewBookingBrowserNotification(change.doc.data());
          }
        });
      },
      (error) => {
        console.error('Error listening to bookings:', error);
      }
    );

    return () => unsubscribe();
  }, [ADMIN_NOTIFICATION_PREFERENCE_KEY]);

  useEffect(() => {
    const savedPreference = localStorage.getItem(
      ADMIN_NOTIFICATION_PREFERENCE_KEY
    );

    if (!savedPreference) {
      setShowNotificationPrompt(true);
    }
  }, [ADMIN_NOTIFICATION_PREFERENCE_KEY]);

  const filteredBookings = useMemo(() => {
    if (activeTab === 'all') return bookings;
    return bookings.filter((booking) => booking.status === activeTab);
  }, [bookings, activeTab]);

  const stats = useMemo(() => {
    const totalRevenue = bookings
      .filter((b) => b.status === 'confirmed' || b.status === 'completed')
      .reduce((sum, b) => sum + (Number(b.price) || 0), 0);

    return {
      all: bookings.length,
      today: bookings.filter((b) => isBusinessToday(b.bookingDate)).length,
      pending: bookings.filter((b) => b.status === 'pending').length,
      confirmed: bookings.filter((b) => b.status === 'confirmed').length,
      cancelled: bookings.filter((b) => b.status === 'cancelled').length,
      revenue: totalRevenue,
    };
  }, [bookings]);

  const updateBookingStatus = async (bookingId, status, bookingDetails) => {
    try {
      const action = status === 'confirmed' ? 'approve' : 'cancel';

      await runBookingAdminAction(action, bookingId, bookingDetails);

      setBookings((prev) =>
        prev.map((booking) =>
          booking.id === bookingId ? { ...booking, status } : booking
        )
      );
    } catch (error) {
      console.error('Error updating booking:', error);
      setErrorMessage('Failed to update booking status.');
    }
  };

  const fetchSettings = async () => {
    try {
      const ref = doc(db, 'siteConfig', 'settings');
      const snapshot = await getDoc(ref);

      if (snapshot.exists()) {
        setSettings((prev) => ({
          ...prev,
          ...snapshot.data(),
        }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchBannedUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'bannedUsers'));
      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));
      setBannedUsers(data);
    } catch (error) {
      console.error('Error fetching banned users:', error);
    }
  };

  const fetchReviews = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'reviews'));
      const data = snapshot.docs
        .map((item) => ({
          id: item.id,
          ...item.data(),
        }))
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      setReviews(data);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const fetchGalleryItems = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'gallery'));
      const data = snapshot.docs
        .map((item) => ({
          id: item.id,
          ...item.data(),
        }))
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      setGalleryItems(data);
    } catch (error) {
      console.error('Error fetching gallery items:', error);
    }
  };

  const addBannedUser = async () => {
    if (!bannedPhone.trim()) {
      setBannedMessage('Please enter a phone number.');
      return;
    }

    try {
      setBannedLoading(true);
      setBannedMessage('');

      await addDoc(collection(db, 'bannedUsers'), {
        phone: bannedPhone.trim(),
        reason: bannedReason.trim(),
        createdAt: new Date().toISOString(),
      });

      setBannedPhone('');
      setBannedReason('');
      setBannedMessage('Phone number banned successfully.');
      fetchBannedUsers();
    } catch (error) {
      console.error('Error adding banned user:', error);
      setBannedMessage('Failed to ban phone number.');
    } finally {
      setBannedLoading(false);
    }
  };

  const removeBannedUser = async (id) => {
    try {
      await deleteDoc(doc(db, 'bannedUsers', id));
      setBannedUsers((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error('Error removing banned user:', error);
      setBannedMessage('Failed to remove banned number.');
    }
  };

  const addReview = async () => {
    if (!reviewCustomerName.trim() || !reviewText.trim()) {
      setReviewsMessage('Please complete name and review text.');
      return;
    }

    try {
      setReviewsLoading(true);
      setReviewsMessage('');

      await addDoc(collection(db, 'reviews'), {
        customerName: reviewCustomerName.trim(),
        rating: Number(reviewRating),
        text: reviewText.trim(),
        isVisible: true,
        createdAt: new Date().toISOString(),
      });

      setReviewCustomerName('');
      setReviewRating('5');
      setReviewText('');
      setReviewsMessage('Review added successfully.');
      fetchReviews();
    } catch (error) {
      console.error('Error adding review:', error);
      setReviewsMessage('Failed to add review.');
    } finally {
      setReviewsLoading(false);
    }
  };

  const toggleReviewVisibility = async (review) => {
    try {
      await updateDoc(doc(db, 'reviews', review.id), {
        isVisible: !review.isVisible,
      });

      setReviews((prev) =>
        prev.map((item) =>
          item.id === review.id
            ? { ...item, isVisible: !item.isVisible }
            : item
        )
      );
    } catch (error) {
      console.error('Error updating review visibility:', error);
      setReviewsMessage('Failed to update review visibility.');
    }
  };

  const deleteReview = async (id) => {
    try {
      await deleteDoc(doc(db, 'reviews', id));
      setReviews((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error('Error deleting review:', error);
      setReviewsMessage('Failed to delete review.');
    }
  };

  const addGalleryItem = async () => {
    if (!galleryImageFile) {
      setGalleryMessage('Please choose an image to upload.');
      return;
    }

    try {
      setGalleryLoading(true);
      setGalleryMessage('');

      const safeFileName = galleryImageFile.name.replace(/[^a-zA-Z0-9.-]/g, '-');
      const storageRef = ref(
        storage,
        `gallery/${Date.now()}-${safeFileName}`
      );
      const storagePath = storageRef.fullPath;

      await uploadBytes(storageRef, galleryImageFile);
      const imageUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'gallery'), {
        imageUrl,
        storagePath,
        title: galleryTitle.trim(),
        isVisible: true,
        createdAt: new Date().toISOString(),
      });

      setGalleryImageFile(null);
      setGalleryTitle('');
      setGalleryMessage('Gallery item added successfully.');
      fetchGalleryItems();
    } catch (error) {
      console.error('Error adding gallery item:', error);
      setGalleryMessage('Failed to add gallery item.');
    } finally {
      setGalleryLoading(false);
    }
  };

  const toggleGalleryVisibility = async (item) => {
    try {
      await updateDoc(doc(db, 'gallery', item.id), {
        isVisible: !item.isVisible,
      });

      setGalleryItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? { ...entry, isVisible: !entry.isVisible }
            : entry
        )
      );
    } catch (error) {
      console.error('Error updating gallery visibility:', error);
      setGalleryMessage('Failed to update gallery visibility.');
    }
  };

  const deleteGalleryItem = async (id) => {
    try {
      const galleryItem = galleryItems.find((item) => item.id === id);

      if (galleryItem?.storagePath) {
        try {
          await deleteObject(ref(storage, galleryItem.storagePath));
        } catch (storageError) {
          console.error('Error deleting gallery image from storage:', storageError);
        }
      }

      await deleteDoc(doc(db, 'gallery', id));
      setGalleryItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error('Error deleting gallery item:', error);
      setGalleryMessage('Failed to delete gallery item.');
    }
  };

  const saveSettings = async () => {
    try {
      setSettingsLoading(true);
      setSettingsMessage('');

      const ref = doc(db, 'siteConfig', 'settings');
      const isUpdatingPassword =
        currentAdminPassword || newAdminPassword || confirmAdminPassword;

      if (isUpdatingPassword) {
        if (!currentAdminPassword || !newAdminPassword || !confirmAdminPassword) {
          setSettingsMessage('Please complete all password fields.');
          return;
        }

        if (newAdminPassword !== confirmAdminPassword) {
          setSettingsMessage('New passwords do not match.');
          return;
        }

        if (!auth.currentUser?.email) {
          setSettingsMessage('You must be signed in to update the admin password.');
          return;
        }

        const credential = EmailAuthProvider.credential(
          auth.currentUser.email,
          currentAdminPassword
        );

        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newAdminPassword);
      }

      const { adminPassword: _adminPassword, ...safeSettings } = settings;
      const payload = {
        ...safeSettings,
      };

      await setDoc(ref, payload, { merge: true });
      setSettings(payload);
      setCurrentAdminPassword('');
      setNewAdminPassword('');
      setConfirmAdminPassword('');

      setSettingsMessage('Settings saved successfully.');
    } catch (error) {
      console.error('Error saving settings:', error);
      setSettingsMessage(
        error.code === 'auth/invalid-credential'
          ? 'Current password is incorrect.'
          : 'Failed to save settings.'
      );
    } finally {
      setSettingsLoading(false);
    }
  };

  const addScheduledClosure = async () => {
    if (!closureForm.startDate || !closureForm.endDate) {
      setClosuresMessage('Please set both start and end dates.');
      return;
    }

    if (closureForm.endDate < closureForm.startDate) {
      setClosuresMessage('End date cannot be before start date.');
      return;
    }

    if (!closureForm.isFullDay) {
      if (!closureForm.startTime || !closureForm.endTime) {
        setClosuresMessage('Please set both start and end times.');
        return;
      }

      if (closureForm.endTime <= closureForm.startTime) {
        setClosuresMessage('End time must be after start time.');
        return;
      }
    }

    try {
      setClosuresLoading(true);
      setClosuresMessage('');

      await addDoc(collection(db, 'scheduledClosures'), {
        startDate: closureForm.startDate,
        endDate: closureForm.endDate,
        isFullDay: closureForm.isFullDay,
        startTime: closureForm.isFullDay ? '' : closureForm.startTime,
        endTime: closureForm.isFullDay ? '' : closureForm.endTime,
        reason: closureForm.reason.trim(),
        createdAt: new Date().toISOString(),
      });

      setClosureForm({
        startDate: '',
        endDate: '',
        isFullDay: true,
        startTime: '',
        endTime: '',
        reason: '',
      });
      setClosuresMessage('Scheduled closure saved successfully.');
    } catch (error) {
      console.error('Error adding scheduled closure:', error);
      setClosuresMessage('Failed to save scheduled closure.');
    } finally {
      setClosuresLoading(false);
    }
  };

  const deleteScheduledClosure = async (closureId) => {
    try {
      await deleteDoc(doc(db, 'scheduledClosures', closureId));
      setClosuresMessage('Scheduled closure deleted.');
    } catch (error) {
      console.error('Error deleting scheduled closure:', error);
      setClosuresMessage('Failed to delete scheduled closure.');
    }
  };

  const handleNotificationPreference = async (shouldEnable) => {
    if (!shouldEnable) {
      localStorage.setItem(
        ADMIN_NOTIFICATION_PREFERENCE_KEY,
        'disabled'
      );
      setShowNotificationPrompt(false);
      return;
    }

    try {
      setNotificationPromptLoading(true);

      if (typeof Notification === 'undefined') {
        localStorage.setItem(
          ADMIN_NOTIFICATION_PREFERENCE_KEY,
          'unsupported'
        );
      } else {
        const permission = await Notification.requestPermission();
        localStorage.setItem(ADMIN_NOTIFICATION_PREFERENCE_KEY, permission);
      }

      setShowNotificationPrompt(false);
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      localStorage.setItem(
        ADMIN_NOTIFICATION_PREFERENCE_KEY,
        'error'
      );
      setShowNotificationPrompt(false);
    } finally {
      setNotificationPromptLoading(false);
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
        .admin-shell,
        .admin-top-bar,
        .admin-section-tabs,
        .admin-stats-grid,
        .admin-panel,
        .admin-booking-card,
        .admin-booking-header,
        .admin-booking-meta,
        .admin-booking-actions {
          min-width: 0;
          box-sizing: border-box;
        }

        @media (max-width: 768px) {
          .admin-shell {
            padding-left: 0 !important;
            padding-right: 0 !important;
          }

          .admin-top-bar {
            align-items: flex-start !important;
          }

          .admin-stats-grid {
            grid-template-columns: 1fr !important;
          }

          .admin-section-tabs {
            flex-direction: column;
          }

          .admin-section-tabs button {
            width: 100%;
          }

          .admin-panel {
            padding: 20px !important;
          }

          .admin-booking-header {
            flex-direction: column;
            align-items: flex-start !important;
          }

          .admin-booking-meta {
            grid-template-columns: 1fr !important;
          }

          .admin-booking-actions button {
            width: 100%;
          }
        }
      `}</style>

      <div className="admin-shell" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', minWidth: 0 }}>
        <div
          className="admin-top-bar"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            marginBottom: '26px',
          }}
        >
          <button
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

          <button
            onClick={async () => {
              try {
                await signOut(auth);
              } finally {
                sessionStorage.removeItem('oxfordAdminAuth');
                sessionStorage.removeItem('oxfordAdminAuthTime');
                navigate('/');
              }
            }}
            style={{
              background: 'rgba(255,255,255,0.04)',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '999px',
              padding: '12px 18px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Logout
          </button>

          <div
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: '1.8rem',
              fontWeight: 800,
            }}
          >
            Oxford <span style={{ color: '#C6A15B' }}>Admin</span>
          </div>
        </div>

        <div
          className="admin-stats-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          {[
            { label: 'All Bookings', value: stats.all },
            { label: 'Today', value: stats.today },
            { label: 'Pending', value: stats.pending },
            { label: 'Confirmed', value: stats.confirmed },
            { label: 'Revenue', value: `$${stats.revenue}` },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background:
                  'linear-gradient(180deg, rgba(18,18,18,0.96) 0%, rgba(10,10,10,0.98) 100%)',
                border: '1px solid rgba(198,161,91,0.14)',
                borderRadius: '22px',
                padding: '20px',
              }}
            >
              <div
                style={{
                  color: '#A8A8A8',
                  fontSize: '0.9rem',
                  marginBottom: '10px',
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  color: '#C6A15B',
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div
          className="admin-section-tabs"
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '20px',
          }}
        >
          {['bookings', 'settings', 'banned', 'reviews', 'gallery'].map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              style={{
                background:
                  activeSection === section
                    ? 'rgba(198,161,91,0.12)'
                    : 'rgba(255,255,255,0.03)',
                color: activeSection === section ? '#C6A15B' : '#D0D0D0',
                border:
                  activeSection === section
                    ? '1px solid rgba(198,161,91,0.35)'
                    : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '999px',
                padding: '10px 16px',
                cursor: 'pointer',
                fontWeight: 700,
                textTransform: 'capitalize',
              }}
            >
              {section}
            </button>
          ))}
        </div>

        <div
          className="admin-panel"
          style={{
            background:
              'linear-gradient(180deg, rgba(18,18,18,0.96) 0%, rgba(10,10,10,0.98) 100%)',
            border: '1px solid rgba(198,161,91,0.14)',
            borderRadius: '28px',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              color: '#C6A15B',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              fontSize: '0.82rem',
              fontWeight: 700,
              marginBottom: '12px',
            }}
          >
            Admin App
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ maxWidth: '720px' }}>
              <h2
                style={{
                  margin: '0 0 8px',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                }}
              >
                Download Admin App
              </h2>
              <div style={{ color: '#A8A8A8', lineHeight: 1.7 }}>
                Download the separate owner-only Admin App from here. It stays
                connected to the same Firebase backend as this web admin, so
                bookings and updates remain in sync across both.
              </div>
            </div>

            {adminAppDownloadUrl ? (
              <a
                href={adminAppDownloadUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  background:
                    'linear-gradient(135deg, #D4AF37 0%, #C6A15B 55%, #B88B2A 100%)',
                  color: '#0B0B0B',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '14px 22px',
                  fontWeight: 800,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                Direct Download
              </a>
            ) : (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#A8A8A8',
                  whiteSpace: 'nowrap',
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                Coming soon
              </div>
            )}
          </div>
        </div>

        {activeSection === 'bookings' && (
          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              marginBottom: '20px',
            }}
          >
            {['all', 'pending', 'confirmed', 'cancelled'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background:
                  activeTab === tab
                    ? 'rgba(198,161,91,0.12)'
                    : 'rgba(255,255,255,0.03)',
                color: activeTab === tab ? '#C6A15B' : '#D0D0D0',
                border:
                  activeTab === tab
                    ? '1px solid rgba(198,161,91,0.35)'
                    : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '999px',
                padding: '10px 16px',
                cursor: 'pointer',
                fontWeight: 700,
                textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        )}

        {activeSection === 'bookings' && (
          <>
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

        <div
          className="admin-panel"
          style={{
            background:
              'linear-gradient(180deg, rgba(18,18,18,0.96) 0%, rgba(10,10,10,0.98) 100%)',
            border: '1px solid rgba(198,161,91,0.14)',
            borderRadius: '28px',
            padding: '22px',
          }}
        >
          {loading ? (
            <div style={{ color: '#A8A8A8', padding: '12px 4px' }}>
              Loading bookings...
            </div>
          ) : filteredBookings.length === 0 ? (
            <div style={{ color: '#A8A8A8', padding: '12px 4px' }}>
              No bookings found.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {filteredBookings.map((booking) => (
                <div
                  className="admin-booking-card"
                  key={booking.id}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '22px',
                    padding: '20px',
                  }}
                >
                  <div
                    className="admin-booking-header"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '16px',
                      flexWrap: 'wrap',
                      marginBottom: '14px',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '1.2rem',
                          fontWeight: 800,
                          marginBottom: '6px',
                        }}
                      >
                        {booking.customerName || 'No name'}
                      </div>
                      <div style={{ color: '#A8A8A8' }}>
                        {booking.phone || 'No phone'}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '8px 14px',
                        borderRadius: '999px',
                        fontWeight: 800,
                        textTransform: 'capitalize',
                        background:
                          booking.status === 'pending'
                            ? 'rgba(198,161,91,0.12)'
                            : booking.status === 'confirmed'
                            ? 'rgba(88,224,141,0.12)'
                            : 'rgba(255,90,90,0.12)',
                        color:
                          booking.status === 'pending'
                            ? '#C6A15B'
                            : booking.status === 'confirmed'
                            ? '#7EF0AA'
                            : '#FF8E8E',
                        border:
                          booking.status === 'pending'
                            ? '1px solid rgba(198,161,91,0.25)'
                            : booking.status === 'confirmed'
                            ? '1px solid rgba(88,224,141,0.22)'
                            : '1px solid rgba(255,90,90,0.22)',
                      }}
                    >
                      {booking.status}
                    </div>
                  </div>

                  <div
                    className="admin-booking-meta"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ color: '#8C8C8C', fontSize: '0.85rem' }}>
                        Service
                      </div>
                      <div style={{ fontWeight: 700 }}>{booking.serviceName}</div>
                    </div>

                    <div>
                      <div style={{ color: '#8C8C8C', fontSize: '0.85rem' }}>
                        Price
                      </div>
                      <div style={{ fontWeight: 700 }}>${booking.price}</div>
                    </div>

                    <div>
                      <div style={{ color: '#8C8C8C', fontSize: '0.85rem' }}>
                        Date
                      </div>
                      <div style={{ fontWeight: 700 }}>{booking.bookingDate}</div>
                    </div>

                    <div>
                      <div style={{ color: '#8C8C8C', fontSize: '0.85rem' }}>
                        Time
                      </div>
                      <div style={{ fontWeight: 700 }}>{booking.bookingTime}</div>
                    </div>

                    <div>
                      <div style={{ color: '#8C8C8C', fontSize: '0.85rem' }}>
                        Queue
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {booking.queueNumber ? `#${booking.queueNumber}` : 'Not assigned'}
                      </div>
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ color: '#8C8C8C', fontSize: '0.85rem' }}>
                        Notes
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {booking.notes ? booking.notes : 'No notes'}
                      </div>
                    </div>
                  </div>

                  <div
                    className="admin-booking-actions"
                    style={{
                      display: 'flex',
                      gap: '10px',
                      flexWrap: 'wrap',
                      marginTop: '18px',
                    }}
                  >
                    <button
                      onClick={() =>
                        updateBookingStatus(booking.id, 'confirmed', booking)
                      }
                      style={{
                        background: 'rgba(88,224,141,0.12)',
                        color: '#7EF0AA',
                        border: '1px solid rgba(88,224,141,0.22)',
                        borderRadius: '999px',
                        padding: '10px 16px',
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      Approve
                    </button>

                    <button
                      onClick={() =>
                        updateBookingStatus(booking.id, 'cancelled', booking)
                      }
                      style={{
                        background: 'rgba(255,90,90,0.12)',
                        color: '#FF8E8E',
                        border: '1px solid rgba(255,90,90,0.22)',
                        borderRadius: '999px',
                        padding: '10px 16px',
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      Cancel
                    </button>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
          </>
        )}

        {activeSection === 'settings' && (
          <div
            className="admin-panel"
            style={{
              background:
                'linear-gradient(180deg, rgba(18,18,18,0.96) 0%, rgba(10,10,10,0.98) 100%)',
              border: '1px solid rgba(198,161,91,0.14)',
              borderRadius: '28px',
              padding: '24px',
            }}
          >
            <div
              style={{
                color: '#C6A15B',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                fontSize: '0.82rem',
                fontWeight: 700,
                marginBottom: '12px',
              }}
            >
              Site Settings
            </div>

            <h2
              style={{
                margin: '0 0 24px',
                fontSize: '1.8rem',
                fontWeight: 800,
              }}
            >
              Homepage stats, closures & vacation mode
            </h2>

            <div
              style={{
                ...adminFormGridStyle,
                marginBottom: '20px',
              }}
            >
              <div style={adminFieldStyle}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#DADADA', fontWeight: 700 }}>
                  Happy Clients
                </label>
                <input
                  type="text"
                  value={settings.happyClients}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, happyClients: e.target.value }))
                  }
                  style={{
                    width: '100%',
                    background: '#121212',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '16px',
                    padding: '14px 16px',
                    fontSize: '1rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#DADADA', fontWeight: 700 }}>
                  Rating
                </label>
                <input
                  type="text"
                  value={settings.rating}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, rating: e.target.value }))
                  }
                  style={{
                    width: '100%',
                    background: '#121212',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '16px',
                    padding: '14px 16px',
                    fontSize: '1rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#DADADA', fontWeight: 700 }}>
                  Years Experience
                </label>
                <input
                  type="text"
                  value={settings.experience}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, experience: e.target.value }))
                  }
                  style={{
                    width: '100%',
                    background: '#121212',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '16px',
                    padding: '14px 16px',
                    fontSize: '1rem',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '20px',
                padding: '18px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, marginBottom: '6px' }}>Vacation Mode</div>
                  <div style={{ color: '#A8A8A8' }}>
                    When enabled, customers should not be able to send booking requests.
                  </div>
                </div>

                <button
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      vacationMode: !prev.vacationMode,
                    }))
                  }
                  style={{
                    background: settings.vacationMode
                      ? 'rgba(255,90,90,0.12)'
                      : 'rgba(88,224,141,0.12)',
                    color: settings.vacationMode ? '#FF8E8E' : '#7EF0AA',
                    border: settings.vacationMode
                      ? '1px solid rgba(255,90,90,0.22)'
                      : '1px solid rgba(88,224,141,0.22)',
                    borderRadius: '999px',
                    padding: '12px 18px',
                    cursor: 'pointer',
                    fontWeight: 800,
                  }}
                >
                  {settings.vacationMode ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '20px',
                padding: '18px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  marginBottom: '16px',
                }}
              >
                Admin Password
              </div>

              <div
                style={{
                  ...adminFormGridStyle,
                }}
              >
                <div style={adminFieldStyle}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#DADADA', fontWeight: 700 }}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentAdminPassword}
                    onChange={(e) => setCurrentAdminPassword(e.target.value)}
                    style={adminInputStyle}
                  />
                </div>

                <div style={adminFieldStyle}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#DADADA', fontWeight: 700 }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    style={adminInputStyle}
                  />
                </div>

                <div style={adminFieldStyle}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#DADADA', fontWeight: 700 }}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmAdminPassword}
                    onChange={(e) => setConfirmAdminPassword(e.target.value)}
                    style={adminInputStyle}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '20px',
                padding: '18px',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: '8px' }}>
                Scheduled Closures
              </div>
              <div
                style={{
                  color: '#A8A8A8',
                  marginBottom: '16px',
                  lineHeight: 1.7,
                }}
              >
                Add full-day or partial-day closures. The booking page will react
                live and block only the affected dates or time ranges.
              </div>

              <div style={{ ...adminFormGridStyle, marginBottom: '16px' }}>
                <div style={adminFieldStyle}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      color: '#DADADA',
                      fontWeight: 700,
                    }}
                  >
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={closureForm.startDate}
                    onChange={(e) =>
                      setClosureForm((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    style={adminInputStyle}
                  />
                </div>

                <div style={adminFieldStyle}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      color: '#DADADA',
                      fontWeight: 700,
                    }}
                  >
                    End Date
                  </label>
                  <input
                    type="date"
                    value={closureForm.endDate}
                    onChange={(e) =>
                      setClosureForm((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    style={adminInputStyle}
                  />
                </div>

                <div
                  style={{
                    ...adminFieldStyle,
                    display: 'flex',
                    alignItems: 'flex-end',
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setClosureForm((prev) => ({
                        ...prev,
                        isFullDay: !prev.isFullDay,
                      }))
                    }
                    style={{
                      width: '100%',
                      background: closureForm.isFullDay
                        ? 'rgba(255,90,90,0.12)'
                        : 'rgba(88,224,141,0.12)',
                      color: closureForm.isFullDay ? '#FF8E8E' : '#7EF0AA',
                      border: closureForm.isFullDay
                        ? '1px solid rgba(255,90,90,0.22)'
                        : '1px solid rgba(88,224,141,0.22)',
                      borderRadius: '16px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      fontWeight: 800,
                    }}
                  >
                    {closureForm.isFullDay
                      ? 'Full-Day Closure'
                      : 'Partial-Day Closure'}
                  </button>
                </div>
              </div>

              {!closureForm.isFullDay && (
                <div style={{ ...adminFormGridStyle, marginBottom: '16px' }}>
                  <div style={adminFieldStyle}>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '8px',
                        color: '#DADADA',
                        fontWeight: 700,
                      }}
                    >
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={closureForm.startTime}
                      onChange={(e) =>
                        setClosureForm((prev) => ({
                          ...prev,
                          startTime: e.target.value,
                        }))
                      }
                      style={adminInputStyle}
                    />
                  </div>

                  <div style={adminFieldStyle}>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '8px',
                        color: '#DADADA',
                        fontWeight: 700,
                      }}
                    >
                      End Time
                    </label>
                    <input
                      type="time"
                      value={closureForm.endTime}
                      onChange={(e) =>
                        setClosureForm((prev) => ({
                          ...prev,
                          endTime: e.target.value,
                        }))
                      }
                      style={adminInputStyle}
                    />
                  </div>
                </div>
              )}

              <div style={adminFieldStyle}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    color: '#DADADA',
                    fontWeight: 700,
                  }}
                >
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={closureForm.reason}
                  onChange={(e) =>
                    setClosureForm((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  placeholder="Public holiday, maintenance, private event..."
                  style={adminInputStyle}
                />
              </div>

              <div
                style={{
                  marginTop: '16px',
                  display: 'flex',
                  justifyContent: 'flex-start',
                }}
              >
                <button
                  type="button"
                  onClick={addScheduledClosure}
                  disabled={closuresLoading}
                  style={{
                    background:
                      'linear-gradient(135deg, #D4AF37 0%, #C6A15B 55%, #B88B2A 100%)',
                    color: '#0B0B0B',
                    border: 'none',
                    borderRadius: '999px',
                    padding: '14px 22px',
                    fontWeight: 800,
                    cursor: closuresLoading ? 'not-allowed' : 'pointer',
                    opacity: closuresLoading ? 0.7 : 1,
                  }}
                >
                  {closuresLoading ? 'Saving Closure...' : 'Add Closure'}
                </button>
              </div>

              {closuresMessage && (
                <div
                  style={{
                    marginTop: '16px',
                    color:
                      closuresMessage.includes('Failed') ||
                      closuresMessage.includes('Please')
                        ? '#FF8E8E'
                        : '#7EF0AA',
                    fontWeight: 700,
                  }}
                >
                  {closuresMessage}
                </div>
              )}

              <div style={{ display: 'grid', gap: '12px', marginTop: '20px' }}>
                {scheduledClosures.length === 0 ? (
                  <div style={{ color: '#A8A8A8' }}>
                    No scheduled closures saved yet.
                  </div>
                ) : (
                  scheduledClosures.map((closure) => (
                    <div
                      key={closure.id}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '18px',
                        padding: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '16px',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: '#C6A15B',
                            fontWeight: 800,
                            marginBottom: '6px',
                          }}
                        >
                          {formatClosureDateRange(closure)}
                        </div>
                        <div
                          style={{
                            color: '#FFFFFF',
                            fontWeight: 700,
                            marginBottom: '4px',
                          }}
                        >
                          {formatClosureTimeRange(closure)}
                        </div>
                        <div style={{ color: '#A8A8A8' }}>
                          {closure.reason || 'No reason provided'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => deleteScheduledClosure(closure.id)}
                        style={{
                          background: 'rgba(255,90,90,0.12)',
                          color: '#FF8E8E',
                          border: '1px solid rgba(255,90,90,0.22)',
                          borderRadius: '999px',
                          padding: '12px 18px',
                          cursor: 'pointer',
                          fontWeight: 800,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {settingsMessage && (
              <div
                style={{
                  marginBottom: '16px',
                  color:
                    settingsMessage.includes('Failed') ||
                    settingsMessage.includes('Please') ||
                    settingsMessage.includes('incorrect') ||
                    settingsMessage.includes('match')
                      ? '#FF8E8E'
                      : '#7EF0AA',
                  fontWeight: 700,
                }}
              >
                {settingsMessage}
              </div>
            )}

            <button
              onClick={saveSettings}
              disabled={settingsLoading}
              style={{
                background:
                  'linear-gradient(135deg, #D4AF37 0%, #C6A15B 55%, #B88B2A 100%)',
                color: '#0B0B0B',
                border: 'none',
                borderRadius: '999px',
                padding: '14px 22px',
                fontWeight: 800,
                cursor: settingsLoading ? 'not-allowed' : 'pointer',
                opacity: settingsLoading ? 0.7 : 1,
              }}
            >
              {settingsLoading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}

        {activeSection === 'banned' && (
          <div
            className="admin-panel"
            style={{
              background:
                'linear-gradient(180deg, rgba(18,18,18,0.96) 0%, rgba(10,10,10,0.98) 100%)',
              border: '1px solid rgba(198,161,91,0.14)',
              borderRadius: '28px',
              padding: '24px',
            }}
          >
            <div
              style={{
                color: '#C6A15B',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                fontSize: '0.82rem',
                fontWeight: 700,
                marginBottom: '12px',
              }}
            >
              Banned Customers
            </div>

            <h2
              style={{
                margin: '0 0 24px',
                fontSize: '1.8rem',
                fontWeight: 800,
              }}
            >
              Block phone numbers from booking
            </h2>

            <div
              style={{
                ...adminFormGridStyle,
                marginBottom: '16px',
              }}
            >
              <div style={adminFieldStyle}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    color: '#DADADA',
                    fontWeight: 700,
                  }}
                >
                  Phone Number
                </label>
                <input
                  type="text"
                  value={bannedPhone}
                  onChange={(e) => setBannedPhone(e.target.value)}
                  placeholder="Enter phone number"
                  style={adminInputStyle}
                />
              </div>

              <div style={adminFieldStyle}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    color: '#DADADA',
                    fontWeight: 700,
                  }}
                >
                  Reason
                </label>
                <input
                  type="text"
                  value={bannedReason}
                  onChange={(e) => setBannedReason(e.target.value)}
                  placeholder="Reason for ban"
                  style={adminInputStyle}
                />
              </div>
            </div>

            {bannedMessage && (
              <div
                style={{
                  marginBottom: '16px',
                  color:
                    bannedMessage.includes('Failed') || bannedMessage.includes('Please')
                      ? '#FF8E8E'
                      : '#7EF0AA',
                  fontWeight: 700,
                }}
              >
                {bannedMessage}
              </div>
            )}

            <button
              onClick={addBannedUser}
              disabled={bannedLoading}
              style={{
                background:
                  'linear-gradient(135deg, #D4AF37 0%, #C6A15B 55%, #B88B2A 100%)',
                color: '#0B0B0B',
                border: 'none',
                borderRadius: '999px',
                padding: '14px 22px',
                fontWeight: 800,
                cursor: bannedLoading ? 'not-allowed' : 'pointer',
                opacity: bannedLoading ? 0.7 : 1,
                marginBottom: '24px',
              }}
            >
              {bannedLoading ? 'Saving...' : 'Ban Number'}
            </button>

            <div style={{ display: 'grid', gap: '14px' }}>
              {bannedUsers.length === 0 ? (
                <div style={{ color: '#A8A8A8' }}>No banned numbers yet.</div>
              ) : (
                bannedUsers.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '20px',
                      padding: '18px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '16px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{item.phone}</div>
                      <div style={{ color: '#A8A8A8', marginTop: '4px' }}>
                        {item.reason || 'No reason'}
                      </div>
                    </div>

                    <button
                      onClick={() => removeBannedUser(item.id)}
                      style={{
                        background: 'rgba(255,90,90,0.12)',
                        color: '#FF8E8E',
                        border: '1px solid rgba(255,90,90,0.22)',
                        borderRadius: '999px',
                        padding: '10px 16px',
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      Remove Ban
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeSection === 'reviews' && (
          <div
            className="admin-panel"
            style={{
              background:
                'linear-gradient(180deg, rgba(18,18,18,0.96) 0%, rgba(10,10,10,0.98) 100%)',
              border: '1px solid rgba(198,161,91,0.14)',
              borderRadius: '28px',
              padding: '24px',
            }}
          >
            <div
              style={{
                color: '#C6A15B',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                fontSize: '0.82rem',
                fontWeight: 700,
                marginBottom: '12px',
              }}
            >
              Reviews
            </div>

            <h2
              style={{
                margin: '0 0 24px',
                fontSize: '1.8rem',
                fontWeight: 800,
              }}
            >
              Manage customer reviews
            </h2>

            <div
              style={{
                ...adminFormGridStyle,
                marginBottom: '16px',
              }}
            >
              <div style={adminFieldStyle}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#DADADA', fontWeight: 700 }}>
                  Customer Name
                </label>
                <input
                  type="text"
                  value={reviewCustomerName}
                  onChange={(e) => setReviewCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  style={adminInputStyle}
                />
              </div>

              <div style={adminFieldStyle}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#DADADA', fontWeight: 700 }}>
                  Rating
                </label>
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(e.target.value)}
                  style={adminInputStyle}
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} Star{value > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ ...adminFieldStyle, marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#DADADA', fontWeight: 700 }}>
                Review Text
              </label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Write the review"
                rows={4}
                style={{ ...adminInputStyle, resize: 'vertical' }}
              />
            </div>

            {reviewsMessage && (
              <div
                style={{
                  marginBottom: '16px',
                  color: reviewsMessage.includes('Failed') || reviewsMessage.includes('Please')
                    ? '#FF8E8E'
                    : '#7EF0AA',
                  fontWeight: 700,
                }}
              >
                {reviewsMessage}
              </div>
            )}

            <button
              onClick={addReview}
              disabled={reviewsLoading}
              style={{
                background:
                  'linear-gradient(135deg, #D4AF37 0%, #C6A15B 55%, #B88B2A 100%)',
                color: '#0B0B0B',
                border: 'none',
                borderRadius: '999px',
                padding: '14px 22px',
                fontWeight: 800,
                cursor: reviewsLoading ? 'not-allowed' : 'pointer',
                opacity: reviewsLoading ? 0.7 : 1,
                marginBottom: '24px',
              }}
            >
              {reviewsLoading ? 'Saving...' : 'Add Review'}
            </button>

            <div style={{ display: 'grid', gap: '14px' }}>
              {reviews.length === 0 ? (
                <div style={{ color: '#A8A8A8' }}>No reviews yet.</div>
              ) : (
                reviews.map((review) => (
                  <div
                    key={review.id}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '20px',
                      padding: '18px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap',
                        marginBottom: '12px',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>
                          {review.customerName}
                        </div>
                        <div style={{ color: '#C6A15B', marginTop: '4px' }}>
                          {'★'.repeat(Number(review.rating) || 0)}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '8px 14px',
                          borderRadius: '999px',
                          fontWeight: 800,
                          background: review.isVisible
                            ? 'rgba(88,224,141,0.12)'
                            : 'rgba(255,90,90,0.12)',
                          color: review.isVisible ? '#7EF0AA' : '#FF8E8E',
                          border: review.isVisible
                            ? '1px solid rgba(88,224,141,0.22)'
                            : '1px solid rgba(255,90,90,0.22)',
                        }}
                      >
                        {review.isVisible ? 'Visible' : 'Hidden'}
                      </div>
                    </div>

                    <div style={{ color: '#DADADA', lineHeight: 1.7, marginBottom: '16px' }}>
                      {review.text}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => toggleReviewVisibility(review)}
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          color: '#FFFFFF',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '999px',
                          padding: '10px 16px',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        {review.isVisible ? 'Hide' : 'Show'}
                      </button>

                      <button
                        onClick={() => deleteReview(review.id)}
                        style={{
                          background: 'rgba(255,90,90,0.12)',
                          color: '#FF8E8E',
                          border: '1px solid rgba(255,90,90,0.22)',
                          borderRadius: '999px',
                          padding: '10px 16px',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeSection === 'gallery' && (
          <div
            className="admin-panel"
            style={{
              background:
                'linear-gradient(180deg, rgba(18,18,18,0.96) 0%, rgba(10,10,10,0.98) 100%)',
              border: '1px solid rgba(198,161,91,0.14)',
              borderRadius: '28px',
              padding: '24px',
            }}
          >
            <div
              style={{
                color: '#C6A15B',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                fontSize: '0.82rem',
                fontWeight: 700,
                marginBottom: '12px',
              }}
            >
              Gallery
            </div>

            <h2
              style={{
                margin: '0 0 24px',
                fontSize: '1.8rem',
                fontWeight: 800,
              }}
            >
              Manage gallery images
            </h2>

            <div
              style={{
                ...adminFormGridStyle,
                marginBottom: '16px',
              }}
            >
              <div style={adminFieldStyle}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#DADADA', fontWeight: 700 }}>
                  Upload Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setGalleryImageFile(e.target.files?.[0] || null)}
                  style={adminInputStyle}
                />
                <div style={adminHelperTextStyle}>
                  {galleryImageFile ? galleryImageFile.name : 'No image selected'}
                </div>
              </div>

              <div style={adminFieldStyle}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#DADADA', fontWeight: 700 }}>
                  Title
                </label>
                <input
                  type="text"
                  value={galleryTitle}
                  onChange={(e) => setGalleryTitle(e.target.value)}
                  placeholder="Optional title"
                  style={adminInputStyle}
                />
              </div>
            </div>

            {galleryMessage && (
              <div
                style={{
                  marginBottom: '16px',
                  color: galleryMessage.includes('Failed') || galleryMessage.includes('Please')
                    ? '#FF8E8E'
                    : '#7EF0AA',
                  fontWeight: 700,
                }}
              >
                {galleryMessage}
              </div>
            )}

            <button
              onClick={addGalleryItem}
              disabled={galleryLoading}
              style={{
                background:
                  'linear-gradient(135deg, #D4AF37 0%, #C6A15B 55%, #B88B2A 100%)',
                color: '#0B0B0B',
                border: 'none',
                borderRadius: '999px',
                padding: '14px 22px',
                fontWeight: 800,
                cursor: galleryLoading ? 'not-allowed' : 'pointer',
                opacity: galleryLoading ? 0.7 : 1,
                marginBottom: '24px',
              }}
            >
              {galleryLoading ? 'Saving...' : 'Add Image'}
            </button>

            <div style={{ display: 'grid', gap: '14px' }}>
              {galleryItems.length === 0 ? (
                <div style={{ color: '#A8A8A8' }}>No gallery items yet.</div>
              ) : (
                galleryItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '20px',
                      padding: '18px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap',
                        marginBottom: '14px',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>
                          {item.title || 'Untitled'}
                        </div>
                        <div style={{ color: '#A8A8A8', marginTop: '4px', wordBreak: 'break-all' }}>
                          {item.imageUrl}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '8px 14px',
                          borderRadius: '999px',
                          fontWeight: 800,
                          background: item.isVisible
                            ? 'rgba(88,224,141,0.12)'
                            : 'rgba(255,90,90,0.12)',
                          color: item.isVisible ? '#7EF0AA' : '#FF8E8E',
                          border: item.isVisible
                            ? '1px solid rgba(88,224,141,0.22)'
                            : '1px solid rgba(255,90,90,0.22)',
                        }}
                      >
                        {item.isVisible ? 'Visible' : 'Hidden'}
                      </div>
                    </div>

                    <div
                      style={{
                        width: '100%',
                        height: '220px',
                        borderRadius: '18px',
                        overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.06)',
                        marginBottom: '16px',
                        background: '#121212',
                      }}
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.title || 'Gallery item'}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => toggleGalleryVisibility(item)}
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          color: '#FFFFFF',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '999px',
                          padding: '10px 16px',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        {item.isVisible ? 'Hide' : 'Show'}
                      </button>

                      <button
                        onClick={() => deleteGalleryItem(item.id)}
                        style={{
                          background: 'rgba(255,90,90,0.12)',
                          color: '#FF8E8E',
                          border: '1px solid rgba(255,90,90,0.22)',
                          borderRadius: '999px',
                          padding: '10px 16px',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {showNotificationPrompt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              background:
                'linear-gradient(180deg, rgba(18,18,18,0.98) 0%, rgba(10,10,10,1) 100%)',
              border: '1px solid rgba(198,161,91,0.18)',
              borderRadius: '24px',
              padding: '26px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
            }}
          >
            <div
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: '1.45rem',
                fontWeight: 800,
                marginBottom: '10px',
              }}
            >
              Browser Notifications
            </div>

            <div
              style={{
                color: '#A8A8A8',
                marginBottom: '22px',
                lineHeight: 1.6,
              }}
            >
              Do you want to receive browser notifications?
            </div>

            <div
              style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => handleNotificationPreference(false)}
                disabled={notificationPromptLoading}
                style={{
                  background: 'transparent',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '999px',
                  padding: '12px 18px',
                  cursor: notificationPromptLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  opacity: notificationPromptLoading ? 0.7 : 1,
                }}
              >
                No
              </button>

              <button
                type="button"
                onClick={() => handleNotificationPreference(true)}
                disabled={notificationPromptLoading}
                style={{
                  background:
                    'linear-gradient(135deg, #D4AF37 0%, #C6A15B 55%, #B88B2A 100%)',
                  color: '#0B0B0B',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '12px 18px',
                  cursor: notificationPromptLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 800,
                  opacity: notificationPromptLoading ? 0.7 : 1,
                }}
              >
                {notificationPromptLoading ? 'Please wait...' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function shouldSendBrowserNotifications(preferenceKey) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return false;
  }

  return (
    localStorage.getItem(preferenceKey) === 'granted' &&
    Notification.permission === 'granted'
  );
}

function showNewBookingBrowserNotification(booking) {
  if (typeof Notification === 'undefined') return;

  const notification = new Notification('New Oxford Barber booking', {
    body: [
      booking.customerName || 'No name',
      booking.serviceName || 'No service',
      booking.bookingDate || 'No date',
      booking.bookingTime || 'No time',
    ].join(' • '),
  });

  notification.onclick = () => {
    window.focus();
  };
}
