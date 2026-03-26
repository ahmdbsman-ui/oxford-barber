import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  where,
} from 'firebase/firestore';
import { db, phoneAuth } from '../firebase/config';
import {
  formatBusinessDateLabel,
  formatBusinessTimeLabel,
  getBusinessDayOfWeek,
  getBusinessHours,
  getFullDayClosureForDate,
  getPartialDayClosuresForDate,
  getSydneyNowMinutes,
  getSydneyTodayDateString,
  isBusinessToday,
  timeToMinutes,
} from '../utils/businessStatus';

const SERVICES = [
  { id: 1, name: 'Beard Trim', price: 25, duration: 20, desc: 'Clean shaping and detailing for a sharp beard.' },
  { id: 2, name: 'Buzz Cut', price: 25, duration: 20, desc: 'Simple, clean and low-maintenance cut.' },
  { id: 3, name: 'Regular Hair Cut', price: 40, duration: 30, desc: 'Classic haircut tailored to your style.' },
  { id: 4, name: 'Zero Fade', price: 45, duration: 30, desc: 'Sharp fade with clean blending.' },
  { id: 5, name: 'Skin Fade', price: 50, duration: 30, desc: 'Premium fade with detailed finish.' },
  { id: 6, name: 'Scissor Cut', price: 50, duration: 30, desc: 'Scissor-only cut for natural shape.' },
];

const SAME_DAY_BOOKING_LEAD_MINUTES = 120;

function getSelectedServiceNames(services) {
  return services.map((service) => service.name).join(', ');
}

function isActiveBlockingBookingStatus(status) {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  return normalizedStatus === 'pending' || normalizedStatus === 'confirmed';
}

function closureBlocksTime(closure, bookingTime, bookingDuration) {
  if (!closure?.startTime || !closure?.endTime || !bookingTime || !bookingDuration) {
    return false;
  }

  return bookingsOverlap(
    bookingTime,
    bookingDuration,
    closure.startTime,
    timeToMinutes(closure.endTime) - timeToMinutes(closure.startTime)
  );
}

function formatDateLabel(dateString) {
  return formatBusinessDateLabel(dateString);
}

function isSunday(dateString) {
  if (!dateString) return false;
  return getBusinessDayOfWeek(dateString) === 0;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatTimeLabel(time24) {
  return formatBusinessTimeLabel(time24);
}

function bookingsOverlap(startTimeA, durationA, startTimeB, durationB) {
  const startA = timeToMinutes(startTimeA);
  const endA = startA + durationA;
  const startB = timeToMinutes(startTimeB);
  const endB = startB + durationB;

  return startA < endB && startB < endA;
}

function generateTimeSlots(dateString, duration) {
  const hours = getBusinessHours(dateString);
  if (!hours) return [];

  const slots = [];
  const start = timeToMinutes(hours.start);
  const end = timeToMinutes(hours.end);

  for (let current = start; current + duration <= end; current += 30) {
    slots.push(minutesToTime(current));
  }

  return slots;
}

function generateCancellationToken() {
  return `OXB-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now()
    .toString(36)
    .toUpperCase()}`;
}

function sanitizePhoneInput(value) {
  return value.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '').slice(0, 12);
}

function normalizeAustralianMobile(value) {
  const cleaned = value.replace(/[^\d+]/g, '');

  if (/^04\d{8}$/.test(cleaned)) {
    return cleaned;
  }

  if (/^\+614\d{8}$/.test(cleaned)) {
    return `0${cleaned.slice(3)}`;
  }

  if (/^614\d{8}$/.test(cleaned)) {
    return `0${cleaned.slice(2)}`;
  }

  return null;
}

function toE164AustralianMobile(normalizedPhone) {
  if (!normalizedPhone || !/^04\d{8}$/.test(normalizedPhone)) return '';
  return `+61${normalizedPhone.slice(1)}`;
}

function getDeviceIdentifier() {
  const storageKey = 'oxfordBarberBookingDeviceId';
  const existingId = localStorage.getItem(storageKey);

  if (existingId) return existingId;

  const newId = `device-${Math.random().toString(36).slice(2, 10)}-${Date.now()
    .toString(36)}`;
  localStorage.setItem(storageKey, newId);
  return newId;
}

async function createBookingWithQueue(booking) {
  const counterRef = doc(db, 'bookingQueueCounters', booking.bookingDate);
  const bookingRef = doc(collection(db, 'bookings'));

  return runTransaction(db, async (transaction) => {
    const counterSnapshot = await transaction.get(counterRef);
    const lastQueueNumber = counterSnapshot.exists()
      ? Number(counterSnapshot.data().lastQueueNumber) || 0
      : 0;
    const queueNumber = lastQueueNumber + 1;

    transaction.set(
      counterRef,
      {
        lastQueueNumber: queueNumber,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    transaction.set(bookingRef, {
      ...booking,
      queueNumber,
    });

    return queueNumber;
  });
}

async function sendTelegramNotification(booking) {
  const botToken = process.env.REACT_APP_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.REACT_APP_TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) return;

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: [
        'ðŸ”” New Booking Request',
        '',
        `ðŸ‘¤ Name: ${booking.customerName}`,
        `ðŸ“ž Phone: ${booking.phone}`,
        `âœ‚ï¸ Service: ${booking.serviceName}`,
        `ðŸ“… Date: ${booking.bookingDate}`,
        `â° Time: ${booking.bookingTime}`,
        `ðŸ“ Notes: ${booking.notes || 'None'}`,
        `ðŸ“Œ Status: ${booking.status || 'pending'}`,
        `ðŸŽŸï¸ Queue: #${booking.queueNumber}`,
      ].join('\n'),
    }),
  });

  if (!response.ok) {
    throw new Error('Telegram notification failed');
  }
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at top left, #1a1a1a 0%, #0b0b0b 45%, #050505 100%)',
    color: '#FFFFFF',
    fontFamily: "'Inter', sans-serif",
    padding: '36px 20px 60px',
  },
  wrap: { maxWidth: '1180px', margin: '0 auto' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' },
  panelGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.22fr) minmax(300px, 0.78fr)', gap: '40px', alignItems: 'start' },
  panel: {
    background: 'linear-gradient(180deg, rgba(18,18,18,0.96) 0%, rgba(10,10,10,0.98) 100%)',
    border: '1px solid rgba(198,161,91,0.14)',
    borderRadius: '28px',
    padding: '32px',
    boxSizing: 'border-box',
    minWidth: 0,
  },
  pill: { borderRadius: '999px', padding: '10px 16px', fontWeight: 700, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#FFFFFF', cursor: 'pointer' },
  primary: { borderRadius: '999px', padding: '14px 24px', fontWeight: 800, border: 'none', background: 'linear-gradient(135deg, #D4AF37 0%, #C6A15B 55%, #B88B2A 100%)', color: '#0B0B0B', cursor: 'pointer' },
  input: { width: '100%', background: '#121212', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '15px 16px', fontSize: '1rem', boxSizing: 'border-box' },
};

export default function Booking() {
  const MAX_NOTES_LENGTH = 150;
  const navigate = useNavigate();
  const today = getSydneyTodayDateString();

  const [selectedServiceIds, setSelectedServiceIds] = useState([3]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedTime, setSelectedTime] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookedBookings, setBookedBookings] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bannedPhones, setBannedPhones] = useState([]);
  const [banCheckLoaded, setBanCheckLoaded] = useState(false);
  const [vacationMode, setVacationMode] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [scheduledClosures, setScheduledClosures] = useState([]);
  const [closuresLoaded, setClosuresLoaded] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [currentSydneyMinutes, setCurrentSydneyMinutes] = useState(() =>
    getSydneyNowMinutes()
  );

  useEffect(() => {
    const savedServices = localStorage.getItem('selectedServices');

    if (savedServices) {
      try {
        const parsedServices = JSON.parse(savedServices);
        const parsedIds = Array.isArray(parsedServices)
          ? parsedServices
              .map((service) => Number(service?.id))
              .filter((id) => SERVICES.some((service) => service.id === id))
          : [];

        if (parsedIds.length > 0) {
          setSelectedServiceIds([...new Set(parsedIds)]);
          return;
        }
      } catch (error) {
        console.error('Failed to parse selected services:', error);
      }
    }

    const savedService = localStorage.getItem('selectedService');
    if (!savedService) return;

    try {
      const parsed = JSON.parse(savedService);
      if (parsed?.id) setSelectedServiceIds([parsed.id]);
    } catch (error) {
      console.error('Failed to parse selected service:', error);
    }
  }, []);

  useEffect(() => {
    if (isSunday(selectedDate)) setSelectedTime('');
  }, [selectedDate]);

  useEffect(() => {
    if (!selectedDate || isSunday(selectedDate)) {
      setBookedBookings([]);
      setSlotsLoading(false);
      return undefined;
    }

    setSlotsLoading(true);

    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('bookingDate', '==', selectedDate)
    );

    const unsubscribe = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        const reserved = snapshot.docs
          .map((docItem) => docItem.data())
          .filter((item) => isActiveBlockingBookingStatus(item.status))
          .map((item) => ({
            bookingTime: item.bookingTime,
            duration: Number(item.duration) || 30,
          }))
          .filter((item) => item.bookingTime);

        setBookedBookings(reserved);
        setSlotsLoading(false);
      },
      (error) => {
        console.error('Error listening to booked times:', error);
        setBookedBookings([]);
        setSlotsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedDate]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'siteConfig', 'settings'),
      (snapshot) => {
        setVacationMode(Boolean(snapshot.data()?.vacationMode));
        setSettingsLoaded(true);
      },
      (error) => {
        console.error('Error listening to settings:', error);
        setSettingsLoaded(true);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'scheduledClosures'),
      (snapshot) => {
        const nextClosures = snapshot.docs
          .map((item) => ({
            id: item.id,
            ...item.data(),
          }))
          .sort((left, right) =>
            `${left.startDate || ''}${left.startTime || ''}`.localeCompare(
              `${right.startDate || ''}${right.startTime || ''}`
            )
          );

        setScheduledClosures(nextClosures);
        setClosuresLoaded(true);
      },
      (error) => {
        console.error('Error listening to scheduled closures:', error);
        setClosuresLoaded(true);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchBannedPhones = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'bannedUsers'));
        const phones = snapshot.docs.map((item) => item.data().phone?.trim());
        setBannedPhones(phones.filter(Boolean));
      } catch (error) {
        console.error('Error fetching banned phones:', error);
      } finally {
        setBanCheckLoaded(true);
      }
    };

    fetchBannedPhones();
  }, []);

  const selectedServices = useMemo(
    () => SERVICES.filter((service) => selectedServiceIds.includes(service.id)),
    [selectedServiceIds]
  );

  const totalPrice = useMemo(
    () => selectedServices.reduce((sum, service) => sum + service.price, 0),
    [selectedServices]
  );

  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, service) => sum + service.duration, 0),
    [selectedServices]
  );

  const combinedServiceNames = useMemo(
    () => getSelectedServiceNames(selectedServices),
    [selectedServices]
  );

  const selectedDateFullDayClosure = useMemo(
    () => getFullDayClosureForDate(scheduledClosures, selectedDate),
    [scheduledClosures, selectedDate]
  );

  const selectedDatePartialClosures = useMemo(
    () => getPartialDayClosuresForDate(scheduledClosures, selectedDate),
    [scheduledClosures, selectedDate]
  );

  const isScheduledClosedFullDay = Boolean(selectedDateFullDayClosure);
  const isBookingsClosed = vacationMode || isScheduledClosedFullDay;

  const availableSlots = useMemo(() => {
    if (!selectedDate || isSunday(selectedDate) || totalDuration <= 0 || isBookingsClosed) {
      return [];
    }

    const generatedSlots = generateTimeSlots(selectedDate, totalDuration);

    if (!isBusinessToday(selectedDate)) {
      return generatedSlots;
    }

    return generatedSlots.filter(
      (slotTime) =>
        timeToMinutes(slotTime) >=
        currentSydneyMinutes + SAME_DAY_BOOKING_LEAD_MINUTES
    );
  }, [currentSydneyMinutes, isBookingsClosed, selectedDate, totalDuration]);

  const unavailableTimes = useMemo(
    () =>
      availableSlots.filter((slotTime) =>
        bookedBookings.some((booking) =>
          bookingsOverlap(
            slotTime,
            totalDuration,
            booking.bookingTime,
            booking.duration
          )
        ) ||
        selectedDatePartialClosures.some((closure) =>
          closureBlocksTime(closure, slotTime, totalDuration)
        )
      ),
    [availableSlots, bookedBookings, selectedDatePartialClosures, totalDuration]
  );

  useEffect(() => {
    if (selectedTime && unavailableTimes.includes(selectedTime)) {
      setSelectedTime('');
    }
  }, [selectedTime, unavailableTimes]);

  useEffect(() => {
    if (selectedTime && isBookingsClosed) {
      setSelectedTime('');
    }
  }, [isBookingsClosed, selectedTime]);

  useEffect(() => {
    return () => {
      if (window.bookingRecaptchaVerifier) {
        window.bookingRecaptchaVerifier.clear();
        window.bookingRecaptchaVerifier = null;
      }
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentSydneyMinutes(getSydneyNowMinutes());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;

    const timer = window.setInterval(() => {
      setResendCooldown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const openingHoursLabel = useMemo(() => {
    const hours = getBusinessHours(selectedDate);
    return hours ? `${formatTimeLabel(hours.start)} - ${formatTimeLabel(hours.end)}` : 'Closed';
  }, [selectedDate]);

  const closureStatusMessage = useMemo(() => {
    if (vacationMode) {
      return 'Bookings are temporarily unavailable right now.';
    }

    if (selectedDateFullDayClosure) {
      return selectedDateFullDayClosure.reason
        ? `Closed: ${selectedDateFullDayClosure.reason}`
        : 'This day is scheduled as closed.';
    }

    return '';
  }, [selectedDateFullDayClosure, vacationMode]);

  const toggleServiceSelection = (serviceId) => {
    setSelectedServiceIds((current) => {
      if (current.includes(serviceId)) {
        return current.filter((id) => id !== serviceId);
      }

      return [...current, serviceId].sort((left, right) => left - right);
    });
    setErrorMessage('');
  };

  const resetPhoneVerification = () => {
    setVerificationCode('');
    setConfirmationResult(null);
    setIsPhoneVerified(false);
    setVerifiedPhone('');
    setVerificationMessage('');
    setResendCooldown(0);
  };

  const checkActiveBookingRestrictions = async (normalizedPhone, deviceId) => {
    const activeStatuses = ['pending', 'confirmed'];

    const phoneBookingsSnapshot = await getDocs(
      query(collection(db, 'bookings'), where('phone', '==', normalizedPhone))
    );
    const hasActivePhoneBooking = phoneBookingsSnapshot.docs.some((docItem) =>
      activeStatuses.includes(docItem.data().status)
    );

    if (hasActivePhoneBooking) {
      return 'This phone number already has an active booking. Please manage or cancel the existing booking first.';
    }

    const deviceBookingsSnapshot = await getDocs(
      query(collection(db, 'bookings'), where('deviceId', '==', deviceId))
    );
    const hasActiveDeviceBooking = deviceBookingsSnapshot.docs.some((docItem) =>
      activeStatuses.includes(docItem.data().status)
    );

    if (hasActiveDeviceBooking) {
      return 'This device already has an active booking. Please manage or cancel the existing booking first.';
    }

    return '';
  };

  const handleSendCode = async () => {
    const normalizedPhone = normalizeAustralianMobile(phone);
    const deviceId = getDeviceIdentifier();

    if (!normalizedPhone) {
      return setErrorMessage(
        'Please enter a valid Australian mobile number in the format 04XXXXXXXX or +614XXXXXXXX.'
      );
    }

    if (resendCooldown > 0) {
      return setErrorMessage(`Resend available in ${resendCooldown}s.`);
    }

    if (!banCheckLoaded) {
      return setErrorMessage('Please wait a moment and try again.');
    }

    if (bannedPhones.includes(normalizedPhone)) {
      return setErrorMessage('This phone number is not allowed to make bookings.');
    }

    try {
      setIsSendingCode(true);
      setErrorMessage('');
      setVerificationMessage('');

      const restrictionMessage = await checkActiveBookingRestrictions(
        normalizedPhone,
        deviceId
      );

      if (restrictionMessage) {
        setErrorMessage(restrictionMessage);
        return;
      }

      if (!window.bookingRecaptchaVerifier) {
        window.bookingRecaptchaVerifier = new RecaptchaVerifier(
          phoneAuth,
          'booking-phone-recaptcha',
          { size: 'invisible' }
        );
      }

      const result = await signInWithPhoneNumber(
        phoneAuth,
        toE164AustralianMobile(normalizedPhone),
        window.bookingRecaptchaVerifier
      );

      setConfirmationResult(result);
      setVerificationCode('');
      setIsPhoneVerified(false);
      setVerifiedPhone('');
      setVerificationMessage('Verification code sent to your phone.');
      setResendCooldown(90);
    } catch (error) {
      console.error('Error sending verification code:', error);
      setErrorMessage('Failed to send verification code. Please try again.');

      if (window.bookingRecaptchaVerifier) {
        window.bookingRecaptchaVerifier.clear();
        window.bookingRecaptchaVerifier = null;
      }
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    const normalizedPhone = normalizeAustralianMobile(phone);

    if (!confirmationResult) {
      return setErrorMessage('Please send the verification code first.');
    }

    if (!verificationCode.trim()) {
      return setErrorMessage('Please enter the verification code.');
    }

    try {
      setIsVerifyingCode(true);
      setErrorMessage('');

      const result = await confirmationResult.confirm(verificationCode.trim());
      const verifiedAuthPhone = normalizeAustralianMobile(
        result.user.phoneNumber || ''
      );

      if (!verifiedAuthPhone || verifiedAuthPhone !== normalizedPhone) {
        setErrorMessage(
          'Verified phone number does not match the booking phone number.'
        );
        return;
      }

      setIsPhoneVerified(true);
      setVerifiedPhone(normalizedPhone);
      setVerificationMessage('Phone number verified successfully.');
      await signOut(phoneAuth);
    } catch (error) {
      console.error('Error verifying code:', error);
      setErrorMessage('Invalid verification code. Please try again.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!customerName.trim()) return setErrorMessage('Please enter your name.');
    if (!phone.trim()) return setErrorMessage('Please enter your phone number.');
    if (selectedServices.length === 0) {
      return setErrorMessage('Please choose at least one service.');
    }
    if (!selectedDate) return setErrorMessage('Please choose a date.');
    if (isSunday(selectedDate)) return setErrorMessage('Oxford Barber is closed on Sunday.');
    if (!selectedTime) return setErrorMessage('Please choose a time.');
    if (vacationMode) return setErrorMessage('Bookings are temporarily unavailable right now.');
    if (isScheduledClosedFullDay) {
      return setErrorMessage(
        selectedDateFullDayClosure?.reason
          ? `This date is closed: ${selectedDateFullDayClosure.reason}`
          : 'This date is currently closed.'
      );
    }

    const normalizedPhone = normalizeAustralianMobile(phone);
    const deviceId = getDeviceIdentifier();
    const trimmedNotes = notes.trim();

    if (!normalizedPhone) {
      return setErrorMessage(
        'Please enter a valid Australian mobile number in the format 04XXXXXXXX or +614XXXXXXXX.'
      );
    }

    if (!banCheckLoaded) {
      return setErrorMessage('Please wait a moment and try again.');
    }

    if (bannedPhones.includes(normalizedPhone)) {
      return setErrorMessage('This phone number is not allowed to make bookings.');
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const restrictionMessage = await checkActiveBookingRestrictions(
        normalizedPhone,
        deviceId
      );

      if (restrictionMessage) {
        setErrorMessage(restrictionMessage);
        return;
      }

      const selectedServicesPayload = selectedServices.map((service) => ({
        id: service.id,
        name: service.name,
        price: service.price,
        duration: service.duration,
      }));

      const booking = {
        customerName: customerName.trim(),
        phone: normalizedPhone,
        notes: trimmedNotes,
        deviceId,
        selectedServices: selectedServicesPayload,
        serviceIds: selectedServicesPayload.map((service) => service.id),
        serviceName: combinedServiceNames,
        serviceNames: combinedServiceNames,
        totalPrice,
        totalDuration,
        price: totalPrice,
        duration: totalDuration,
        bookingDate: selectedDate,
        bookingTime: selectedTime,
        cancellationToken: generateCancellationToken(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      const queueNumber = await createBookingWithQueue(booking);
      const bookingWithQueue = {
        ...booking,
        queueNumber,
      };

      await sendTelegramNotification(bookingWithQueue);

      setSuccessMessage(
        `Your booking request for ${combinedServiceNames} on ${formatDateLabel(selectedDate)} at ${formatTimeLabel(selectedTime)} has been received and is pending confirmation. Your queue number is #${queueNumber}. Your cancellation token is ${booking.cancellationToken}.`
      );
      setStep(4);
    } catch (error) {
      console.error('Error saving booking:', error);
      setErrorMessage('Something went wrong while sending your booking request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Cinzel:wght@600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        .booking-panel-grid,
        .booking-service-grid,
        .booking-time-grid,
        .booking-summary-grid,
        .booking-shell,
        .booking-top-bar,
        .booking-side-column {
          min-width: 0;
          box-sizing: border-box;
        }

        .booking-panel,
        .booking-side-panel {
          min-width: 0;
        }

        .booking-field-block,
        .booking-info-card,
        .booking-alert-box,
        .booking-action-row,
        .booking-success-box,
        .booking-step-pills {
          width: 100%;
          box-sizing: border-box;
          min-width: 0;
        }

        .booking-date-time-step,
        .booking-details-step {
          display: grid;
          gap: 22px;
        }

        @media (max-width: 768px) {
          .booking-shell {
            padding-left: 0 !important;
            padding-right: 0 !important;
          }

          .booking-top-bar {
            align-items: flex-start !important;
          }

          .booking-panel-grid {
            grid-template-columns: 1fr !important;
          }

          .booking-service-grid,
          .booking-time-grid,
          .booking-summary-grid {
            grid-template-columns: 1fr !important;
          }

          .booking-panel,
          .booking-side-panel {
            padding: 20px !important;
          }

          .booking-side-column {
            max-width: 100% !important;
            justify-self: stretch !important;
          }

          .booking-date-time-step,
          .booking-details-step {
            gap: 18px;
          }

          .booking-primary-action,
          .booking-secondary-action {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
      <div className="booking-shell" style={styles.wrap}>
        <div id="booking-phone-recaptcha" />
        <div className="booking-top-bar" style={styles.topBar}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => navigate('/')} style={{ ...styles.pill, color: '#C6A15B', border: '1px solid rgba(198,161,91,0.28)' }}>
              &larr; Back Home
            </button>
            <button type="button" onClick={() => navigate('/cancel-booking')} style={styles.pill}>
              Cancel Booking
            </button>
          </div>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: '1.8rem', fontWeight: 800 }}>
            Oxford <span style={{ color: '#C6A15B' }}>Barber</span>
          </div>
        </div>

        <div className="booking-panel-grid" style={styles.panelGrid}>
          <div className="booking-panel" style={styles.panel}>
            <div style={{ color: '#C6A15B', letterSpacing: '3px', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 700, marginBottom: '12px' }}>
              Booking Request
            </div>
            <h1 style={{ fontSize: '2.3rem', margin: '0 0 12px', fontWeight: 800 }}>Book your appointment</h1>
            <p style={{ color: '#A8A8A8', lineHeight: 1.7, marginBottom: '26px' }}>
              Choose one or more services, date and time, then send your request. Your booking will stay pending until approved.
            </p>

            <div className="booking-step-pills" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '30px' }}>
              {['Service', 'Date & Time', 'Your Details', 'Done'].map((label, index) => (
                <div
                  key={label}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '999px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    border: index + 1 === step ? '1px solid rgba(198,161,91,0.45)' : '1px solid rgba(255,255,255,0.08)',
                    background: index + 1 === step ? 'rgba(198,161,91,0.12)' : 'rgba(255,255,255,0.03)',
                    color: index + 1 === step ? '#C6A15B' : '#B9B9B9',
                  }}
                >
                  {index + 1}. {label}
                </div>
              ))}
            </div>

            {errorMessage && (
              <div className="booking-alert-box" style={{ background: 'rgba(255,90,90,0.08)', border: '1px solid rgba(255,90,90,0.22)', color: '#FF8E8E', borderRadius: '18px', padding: '14px 16px', marginBottom: '24px', fontWeight: 600 }}>
                {errorMessage}
              </div>
            )}

            {step === 1 && (
              <div>
                <div className="booking-service-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  {SERVICES.map((service) => {
                    const isActive = selectedServiceIds.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => toggleServiceSelection(service.id)}
                        style={{
                          textAlign: 'left',
                          padding: '20px',
                          borderRadius: '22px',
                          cursor: 'pointer',
                          border: isActive ? '1px solid rgba(198,161,91,0.45)' : '1px solid rgba(255,255,255,0.08)',
                          background: isActive ? 'rgba(198,161,91,0.1)' : 'rgba(255,255,255,0.03)',
                          color: '#FFFFFF',
                        }}
                      >
                        <div style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>{service.name}</div>
                        <div style={{ color: '#A7A7A7', lineHeight: 1.6, fontSize: '0.95rem', marginBottom: '16px' }}>{service.desc}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ color: '#C6A15B', fontSize: '1.25rem', fontWeight: 800 }}>${service.price}</div>
                          <div style={{ color: '#D9D9D9', background: 'rgba(198,161,91,0.08)', borderRadius: '999px', padding: '8px 12px', fontSize: '0.8rem', fontWeight: 700 }}>
                            {service.duration} min
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: '20px', padding: '18px', borderRadius: '18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ color: '#C6A15B', fontWeight: 700, marginBottom: '10px' }}>Selected Services</div>
                  {selectedServices.length === 0 ? (
                    <div style={{ color: '#A8A8A8' }}>No services selected yet.</div>
                  ) : (
                    <>
                      <div style={{ color: '#FFFFFF', lineHeight: 1.7, marginBottom: '12px' }}>{combinedServiceNames}</div>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ color: '#C6A15B', fontWeight: 800 }}>Total: ${totalPrice}</div>
                        <div style={{ color: '#DADADA', fontWeight: 700 }}>{totalDuration} minutes</div>
                      </div>
                    </>
                  )}
                </div>

                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="booking-primary-action"
                    type="button"
                    disabled={!settingsLoaded || !closuresLoaded || isBookingsClosed || selectedServices.length === 0}
                    onClick={() => {
                      if (selectedServices.length === 0) {
                        setErrorMessage('Please choose at least one service.');
                        return;
                      }
                      if (isBookingsClosed) {
                        setErrorMessage(closureStatusMessage || 'Bookings are currently unavailable.');
                        return;
                      }
                      setErrorMessage('');
                      setStep(2);
                    }}
                    style={{ ...styles.primary, cursor: !settingsLoaded || !closuresLoaded || isBookingsClosed || selectedServices.length === 0 ? 'not-allowed' : 'pointer', opacity: !settingsLoaded || !closuresLoaded || isBookingsClosed || selectedServices.length === 0 ? 0.6 : 1 }}
                  >
                    {!settingsLoaded || !closuresLoaded ? 'Loading...' : isBookingsClosed ? 'Bookings Unavailable' : 'Continue'}
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="booking-date-time-step">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '16px',
                    width: '100%',
                    minWidth: 0,
                    alignItems: 'start',
                  }}
                >
                  <div
                    className="booking-field-block"
                    style={{ width: '100%', minWidth: 0 }}
                  >
                    <label style={{ display: 'block', marginBottom: '10px', fontWeight: 700, color: '#DADADA' }}>Select date</label>
                    <input
                      type="date"
                      min={today}
                      value={selectedDate}
                      onChange={(event) => { setSelectedDate(event.target.value); setSelectedTime(''); setErrorMessage(''); }}
                      style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div
                    className="booking-field-block"
                    style={{ width: '100%', minWidth: 0 }}
                  >
                    <div style={{ display: 'block', marginBottom: '10px', fontWeight: 700, color: '#DADADA' }}>Select time</div>
                    {isSunday(selectedDate) ? (
                      <div style={{ padding: '18px', borderRadius: '18px', background: 'rgba(255,90,90,0.08)', border: '1px solid rgba(255,90,90,0.22)', color: '#FF9B9B', fontWeight: 700 }}>
                        Oxford Barber is closed on Sunday.
                      </div>
                    ) : isBookingsClosed ? (
                      <div style={{ padding: '18px', borderRadius: '18px', background: 'rgba(255,90,90,0.08)', border: '1px solid rgba(255,90,90,0.22)', color: '#FF9B9B', fontWeight: 700 }}>
                        {closureStatusMessage}
                      </div>
                    ) : slotsLoading ? (
                      <div style={{ color: '#A8A8A8', padding: '12px 0' }}>Loading available times...</div>
                    ) : availableSlots.length === 0 ? (
                      <div style={{ color: '#A8A8A8', padding: '12px 0' }}>No booking slots for this date.</div>
                    ) : (
                      <div
                        className="booking-time-grid"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                          gap: '12px',
                          width: '100%',
                          minWidth: 0,
                        }}
                      >
                        {availableSlots.map((time) => {
                          const isBooked = unavailableTimes.includes(time);
                          const isActive = selectedTime === time && !isBooked;

                          return (
                            <button
                              key={time}
                              type="button"
                              disabled={isBooked}
                              onClick={() => {
                                if (!isBooked) {
                                  setSelectedTime(time);
                                  setErrorMessage('');
                                }
                              }}
                              style={{
                                padding: '14px 16px',
                                borderRadius: '16px',
                                cursor: isBooked ? 'not-allowed' : 'pointer',
                                border: isBooked
                                  ? '1px solid rgba(255,90,90,0.35)'
                                  : isActive
                                  ? '1px solid rgba(88,224,141,0.42)'
                                  : '1px solid rgba(88,224,141,0.22)',
                                background: isBooked
                                  ? 'rgba(255,90,90,0.12)'
                                  : isActive
                                  ? 'rgba(88,224,141,0.18)'
                                  : 'rgba(88,224,141,0.08)',
                                color: isBooked ? '#FF8E8E' : '#7EF0AA',
                                fontWeight: 800,
                                opacity: isBooked ? 0.9 : 1,
                              }}
                            >
                              {formatTimeLabel(time)} {isBooked ? '• Unavailable' : '• Available'}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="booking-info-card" style={{ padding: '18px 18px', borderRadius: '18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ color: '#C6A15B', fontWeight: 700, marginBottom: '6px' }}>{formatDateLabel(selectedDate)}</div>
                  <div style={{ color: '#A8A8A8' }}>Opening hours: {openingHoursLabel}</div>
                  {selectedDatePartialClosures.length > 0 && !isScheduledClosedFullDay && (
                    <div style={{ color: '#FFCC8A', marginTop: '8px', lineHeight: 1.6 }}>
                      Closed times:{' '}
                      {selectedDatePartialClosures
                        .map((closure) =>
                          `${formatTimeLabel(closure.startTime)} - ${formatTimeLabel(closure.endTime)}${
                            closure.reason ? ` (${closure.reason})` : ''
                          }`
                        )
                        .join(', ')}
                    </div>
                  )}
                </div>

                <div className="booking-action-row" style={{ paddingTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button className="booking-secondary-action" type="button" onClick={() => setStep(1)} style={styles.pill}>Back</button>
                  <button
                    className="booking-primary-action"
                    type="button"
                    onClick={() => {
                      if (!selectedDate) return setErrorMessage('Please choose a date.');
                      if (isSunday(selectedDate)) return setErrorMessage('Oxford Barber is closed on Sunday.');
                      if (isBookingsClosed) return setErrorMessage(closureStatusMessage || 'Bookings are currently unavailable.');
                      if (selectedServices.length === 0) return setErrorMessage('Please choose at least one service.');
                      if (!selectedTime) return setErrorMessage('Please choose a time.');
                      setErrorMessage('');
                      setStep(3);
                    }}
                    style={styles.primary}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}
            {step === 3 && (
              <form onSubmit={handleSubmit} className="booking-details-step">
                <div className="booking-field-block">
                  <label style={{ display: 'block', marginBottom: '10px', fontWeight: 700, color: '#DADADA' }}>Full name</label>
                  <input type="text" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Enter your name" style={styles.input} />
                </div>
                <div className="booking-field-block">
                  <label style={{ display: 'block', marginBottom: '10px', fontWeight: 700, color: '#DADADA' }}>Phone number</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    maxLength={12}
                    value={phone}
                    onChange={(event) => {
                      setPhone(sanitizePhoneInput(event.target.value));
                      resetPhoneVerification();
                    }}
                    placeholder="04XXXXXXXX or +614XXXXXXXX"
                    style={styles.input}
                  />
                </div>
                <div className="booking-info-card" style={{ padding: '18px', borderRadius: '18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ color: '#C6A15B', fontWeight: 700, marginBottom: '8px' }}>Phone Verification</div>
                  <div style={{ color: '#A8A8A8', lineHeight: 1.7, marginBottom: '14px' }}>
                    Verify your phone number with a one-time code before sending your booking request.
                  </div>
                  <div className="booking-action-row" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={handleSendCode}
                      disabled={
                        isSendingCode ||
                        resendCooldown > 0 ||
                        (isPhoneVerified && verifiedPhone === normalizeAustralianMobile(phone))
                      }
                      style={{
                        ...styles.pill,
                        border: '1px solid rgba(198,161,91,0.28)',
                        color: isPhoneVerified && verifiedPhone === normalizeAustralianMobile(phone) ? '#7EF0AA' : '#C6A15B',
                        cursor:
                          isSendingCode ||
                          resendCooldown > 0 ||
                          (isPhoneVerified && verifiedPhone === normalizeAustralianMobile(phone))
                            ? 'not-allowed'
                            : 'pointer',
                        opacity:
                          isSendingCode ||
                          resendCooldown > 0 ||
                          (isPhoneVerified && verifiedPhone === normalizeAustralianMobile(phone))
                            ? 0.7
                            : 1,
                      }}
                    >
                      {isPhoneVerified && verifiedPhone === normalizeAustralianMobile(phone)
                        ? 'Phone Verified'
                        : isSendingCode
                        ? 'Sending...'
                        : confirmationResult
                        ? 'Resend Code'
                        : 'Send Code'}
                    </button>
                  </div>

                  {resendCooldown > 0 && !isPhoneVerified && (
                    <div style={{ marginTop: '12px', color: '#A8A8A8', fontSize: '0.92rem', fontWeight: 600 }}>
                      Resend available in {resendCooldown}s
                    </div>
                  )}

                  {confirmationResult && !isPhoneVerified && (
                    <div style={{ marginTop: '16px', display: 'grid', gap: '12px' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={verificationCode}
                        onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Enter 6-digit code"
                        style={styles.input}
                      />
                      <div className="booking-action-row" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={handleVerifyCode}
                          disabled={isVerifyingCode}
                          style={{ ...styles.primary, cursor: isVerifyingCode ? 'not-allowed' : 'pointer', opacity: isVerifyingCode ? 0.7 : 1 }}
                        >
                          {isVerifyingCode ? 'Verifying...' : 'Verify Code'}
                        </button>
                      </div>
                    </div>
                  )}

                  {verificationMessage && (
                    <div style={{ marginTop: '14px', color: isPhoneVerified ? '#7EF0AA' : '#C6A15B', fontWeight: 700 }}>
                      {verificationMessage}
                    </div>
                  )}
                </div>
                <div className="booking-field-block">
                  <label style={{ display: 'block', marginBottom: '10px', fontWeight: 700, color: '#DADADA' }}>Notes (optional)</label>
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value.slice(0, MAX_NOTES_LENGTH))} maxLength={MAX_NOTES_LENGTH} placeholder="Anything you want to mention?" rows={4} style={{ ...styles.input, resize: 'vertical' }} />
                  <div style={{ marginTop: '8px', color: '#A8A8A8', fontSize: '0.85rem', textAlign: 'right' }}>
                    {notes.length}/{MAX_NOTES_LENGTH}
                  </div>
                </div>

                <div className="booking-action-row" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', paddingTop: '2px' }}>
                  <button className="booking-secondary-action" type="button" onClick={() => setStep(2)} style={styles.pill}>Back</button>
                  <button className="booking-primary-action" type="submit" disabled={isSubmitting} style={{ ...styles.primary, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
                    {isSubmitting ? 'Sending...' : 'Send Booking Request'}
                  </button>
                </div>
              </form>
            )}

            {step === 4 && (
              <div className="booking-success-box" style={{ background: 'rgba(88,224,141,0.08)', border: '1px solid rgba(88,224,141,0.22)', color: '#9BF0B9', borderRadius: '22px', padding: '24px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '10px' }}>Booking request received</div>
                <div style={{ lineHeight: 1.7, marginBottom: '18px' }}>{successMessage}</div>
                <div className="booking-action-row" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button className="booking-primary-action" type="button" onClick={() => navigate('/')} style={styles.primary}>Back Home</button>
                  <button className="booking-secondary-action" type="button" onClick={() => navigate('/cancel-booking')} style={styles.pill}>Cancel Existing Booking</button>
                </div>
              </div>
            )}
          </div>

          <div className="booking-side-column" style={{ display: 'flex', flexDirection: 'column', gap: '22px', minWidth: 0, maxWidth: '360px', width: '100%', justifySelf: 'end' }}>
            <div className="booking-side-panel" style={styles.panel}>
              <div style={{ color: '#C6A15B', letterSpacing: '2px', textTransform: 'uppercase', fontSize: '0.78rem', fontWeight: 700, marginBottom: '12px' }}>
                Booking Summary
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '8px' }}>
                {selectedServices.length > 0 ? combinedServiceNames : 'No services selected'}
              </div>
              <div style={{ color: '#A8A8A8', lineHeight: 1.7, marginBottom: '18px' }}>
                {selectedServices.length > 0
                  ? selectedServices.map((service) => service.desc).join(' ')
                  : 'Choose one or more services to see your booking summary.'}
              </div>
              {selectedServices.length > 0 && (
                <div style={{ display: 'grid', gap: '8px', marginBottom: '18px' }}>
                  {selectedServices.map((service) => (
                    <div
                      key={service.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '12px',
                        color: '#DADADA',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '14px',
                        padding: '12px 14px',
                      }}
                    >
                      <span>{service.name}</span>
                      <span>${service.price}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="booking-summary-grid" style={{ display: 'grid', gap: '12px' }}>
                {[
                  ['Total Price', `$${totalPrice}`],
                  ['Total Duration', `${totalDuration} minutes`],
                  ['Date', formatDateLabel(selectedDate)],
                  ['Time', selectedTime ? formatTimeLabel(selectedTime) : 'Not selected'],
                  ['Status', 'Pending approval'],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '18px', padding: '14px 16px' }}>
                    <div style={{ color: '#8C8C8C', fontSize: '0.82rem', marginBottom: '4px' }}>{label}</div>
                    <div style={{ color: label === 'Price' || label === 'Status' ? '#C6A15B' : '#FFFFFF', fontWeight: 800 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="booking-side-panel" style={styles.panel}>
              <div style={{ color: '#C6A15B', letterSpacing: '2px', textTransform: 'uppercase', fontSize: '0.78rem', fontWeight: 700, marginBottom: '12px' }}>
                Opening Hours
              </div>
              <div style={{ color: '#DADADA', lineHeight: 1.9 }}>
                <div>Mon-Wed: 9:00 AM - 6:00 PM</div>
                <div>Thursday: 9:00 AM - 7:00 PM</div>
                <div>Friday: 9:00 AM - 6:00 PM</div>
                <div>Saturday: 9:00 AM - 5:00 PM</div>
                <div style={{ color: '#FF9B9B' }}>Sunday: Closed</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
