const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const twilio = require('twilio');

admin.initializeApp();

const twilioAccountSid = defineSecret('TWILIO_ACCOUNT_SID');
const twilioAuthToken = defineSecret('TWILIO_AUTH_TOKEN');
const twilioFromNumber = defineSecret('TWILIO_FROM_NUMBER');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

const ADMIN_EMAILS = new Set([
  '629ahmdbsman@gmail.com',
  'Basmanaljumayli51@gmail.com',
].map(normalizeEmail));
const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;
const REMINDER_LOCK_WINDOW_MS = 15 * 60 * 1000;
const BUSINESS_TIME_ZONE = 'Australia/Sydney';

function formatBookingServicesText(booking) {
  if (booking?.serviceNames) {
    return String(booking.serviceNames).trim();
  }

  if (booking?.selectedServices && Array.isArray(booking.selectedServices)) {
    const names = booking.selectedServices
      .map((service) => String(service?.name || '').trim())
      .filter(Boolean);

    if (names.length > 0) {
      return names.join(' + ');
    }
  }

  if (booking?.services && Array.isArray(booking.services)) {
    const names = booking.services
      .map((service) =>
        typeof service === 'string'
          ? service.trim()
          : String(service?.name || '').trim()
      )
      .filter(Boolean);

    if (names.length > 0) {
      return names.join(' + ');
    }
  }

  return String(booking?.serviceName || 'Booking').trim();
}

function formatSmsTimeLabel(time) {
  const [hours, minutes] = String(time || '').split(':').map(Number);

  if ([hours, minutes].some((value) => Number.isNaN(value))) {
    return String(time || 'N/A');
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;

  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

function buildApprovalSmsMessage(booking) {
  const lines = [
    'Oxford Barber: Your booking is confirmed.',
    `Name: ${booking.customerName || 'Customer'}`,
    `Services: ${formatBookingServicesText(booking)}`,
    `Date: ${booking.bookingDate || 'N/A'}`,
    `Time: ${formatSmsTimeLabel(booking.bookingTime)}`,
  ];

  if (booking.queueNumber) {
    lines.push(`Queue: #${booking.queueNumber}`);
  }

  return lines.join('\n');
}

function buildReminderSmsMessage(booking) {
  const lines = [
    'Oxford Barber reminder:',
    `${booking.customerName || 'Customer'}, this is a reminder for your appointment.`,
    `Services: ${formatBookingServicesText(booking)}`,
    `Date: ${booking.bookingDate || 'N/A'}`,
    `Time: ${formatSmsTimeLabel(booking.bookingTime)}`,
  ];

  if (booking.queueNumber) {
    lines.push(`Queue: #${booking.queueNumber}`);
  }

  return lines.join('\n');
}

async function assertAdminRequest(req) {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : '';

  if (!idToken) {
    throw new Error('Missing auth token.');
  }

  const decodedToken = await admin.auth().verifyIdToken(idToken);

  if (!decodedToken.email || !ADMIN_EMAILS.has(normalizeEmail(decodedToken.email))) {
    throw new Error('Unauthorized admin user.');
  }

  return decodedToken;
}

async function sendSmsMessage(to, body) {
  const normalizedPhone = normalizeAustralianPhoneNumber(to);
  const client = twilio(twilioAccountSid.value(), twilioAuthToken.value());

  return client.messages.create({
    to: normalizedPhone,
    from: twilioFromNumber.value(),
    body,
  });
}

function normalizeAustralianPhoneNumber(phone) {
  const rawValue = String(phone || '').trim();

  if (!rawValue) {
    throw new Error('Missing phone number.');
  }

  const sanitized = rawValue.replace(/[^\d+]/g, '');

  if (sanitized.startsWith('+')) {
    if (!sanitized.startsWith('+61')) {
      throw new Error(`Only Australian phone numbers are supported: ${rawValue}`);
    }

    const digits = sanitized.slice(1);

    if (!/^\d{10,12}$/.test(digits)) {
      throw new Error(`Invalid Australian phone number: ${rawValue}`);
    }

    return `+${digits}`;
  }

  const digitsOnly = sanitized.replace(/\D/g, '');

  if (digitsOnly.startsWith('61')) {
    if (!/^\d{10,12}$/.test(digitsOnly)) {
      throw new Error(`Invalid Australian phone number: ${rawValue}`);
    }

    return `+${digitsOnly}`;
  }

  if (digitsOnly.startsWith('0')) {
    const nationalNumber = digitsOnly.slice(1);

    if (!/^\d{9}$/.test(nationalNumber)) {
      throw new Error(`Invalid Australian phone number: ${rawValue}`);
    }

    return `+61${nationalNumber}`;
  }

  if (/^\d{9}$/.test(digitsOnly)) {
    return `+61${digitsOnly}`;
  }

  throw new Error(`Invalid Australian phone number: ${rawValue}`);
}

function getSydneyNow() {
  return new Date();
}

function getSydneyNowParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const read = (type) =>
    Number(parts.find((part) => part.type === type)?.value || 0);

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
  };
}

function getSydneyDateStringFromParts(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(
    parts.day
  ).padStart(2, '0')}`;
}

function shiftDateString(dateString, days) {
  if (!dateString || !Number.isFinite(days)) return '';

  const [year, month, day] = dateString.split('-').map(Number);

  if ([year, month, day].some((value) => Number.isNaN(value))) {
    return '';
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day + days, 12));

  return `${utcDate.getUTCFullYear()}-${String(
    utcDate.getUTCMonth() + 1
  ).padStart(2, '0')}-${String(utcDate.getUTCDate()).padStart(2, '0')}`;
}

function getTimeMinutes(time) {
  const [hours, minutes] = String(time || '').split(':').map(Number);

  if ([hours, minutes].some((value) => Number.isNaN(value))) {
    return null;
  }

  return hours * 60 + minutes;
}

function isRecentReminderLock(value, now) {
  if (!value) return false;

  const parsed = Date.parse(String(value));

  if (!Number.isFinite(parsed)) return false;

  return now.getTime() - parsed < REMINDER_LOCK_WINDOW_MS;
}

exports.sendBookingApprovedSms = onRequest(
  {
    region: 'australia-southeast1',
    cors: true,
    secrets: [twilioAccountSid, twilioAuthToken, twilioFromNumber],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed.' });
      return;
    }

    try {
      await assertAdminRequest(req);

      const booking = req.body?.booking || {};

      if (!booking.phone) {
        res.status(400).json({ error: 'Missing booking phone number.' });
        return;
      }

      await sendSmsMessage(
        booking.phone,
        buildApprovalSmsMessage(booking)
      );

      res.json({ ok: true });
    } catch (error) {
      console.error('sendBookingApprovedSms failed:', error);
      res.status(500).json({ error: error.message || 'SMS send failed.' });
    }
  }
);

exports.handleAdminBookingAction = onRequest(
  {
    region: 'australia-southeast1',
    cors: true,
    secrets: [twilioAccountSid, twilioAuthToken, twilioFromNumber],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed.' });
      return;
    }

    try {
      await assertAdminRequest(req);

      const action = String(req.body?.action || '').trim().toLowerCase();
      const bookingId = String(req.body?.bookingId || '').trim();
      const bookingInput = req.body?.booking || {};

      if (!bookingId) {
        res.status(400).json({ error: 'Missing booking id.' });
        return;
      }

      if (!['approve', 'cancel'].includes(action)) {
        res.status(400).json({ error: 'Invalid booking action.' });
        return;
      }

      const bookingRef = admin.firestore().collection('bookings').doc(bookingId);
      const bookingSnapshot = await bookingRef.get();

      if (!bookingSnapshot.exists) {
        res.status(404).json({ error: 'Booking not found.' });
        return;
      }

      const storedBooking = bookingSnapshot.data() || {};
      const mergedBooking = {
        id: bookingId,
        ...storedBooking,
        ...bookingInput,
      };
      const nowIso = new Date().toISOString();

      if (action === 'approve') {
        const shouldConfirm = storedBooking.status !== 'confirmed';

        if (shouldConfirm) {
          await bookingRef.set(
            {
              status: 'confirmed',
              reminderSmsSent: false,
              statusUpdatedAt: nowIso,
            },
            { merge: true }
          );
        }

        if (shouldConfirm && mergedBooking.phone) {
          const normalizedPhone = normalizeAustralianPhoneNumber(mergedBooking.phone);

          await sendSmsMessage(
            normalizedPhone,
            buildApprovalSmsMessage({
              ...mergedBooking,
              phone: normalizedPhone,
              status: 'confirmed',
            })
          );

          await bookingRef.set(
            {
              phone: normalizedPhone,
              approvalSmsSentAt: nowIso,
            },
            { merge: true }
          );
        }

        res.json({
          ok: true,
          status: 'confirmed',
        });
        return;
      }

      const shouldCancel = storedBooking.status !== 'cancelled';

      if (shouldCancel) {
        await bookingRef.set(
          {
            status: 'cancelled',
            statusUpdatedAt: nowIso,
          },
          { merge: true }
        );
      }

      res.json({
        ok: true,
        status: 'cancelled',
      });
    } catch (error) {
      console.error('handleAdminBookingAction failed:', error);
      res.status(500).json({ error: error.message || 'Booking action failed.' });
    }
  }
);

exports.sendBookingReminderSms = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: 'Australia/Sydney',
    secrets: [twilioAccountSid, twilioAuthToken, twilioFromNumber],
  },
  async () => {
    const now = getSydneyNow();
    const nowParts = getSydneyNowParts(now);
    const currentDate = getSydneyDateStringFromParts(nowParts);
    const tomorrowDate = shiftDateString(currentDate, 1);
    const currentMinutes = nowParts.hour * 60 + nowParts.minute;
    const snapshot = await admin
      .firestore()
      .collection('bookings')
      .where('status', '==', 'confirmed')
      .get();

    const sendJobs = snapshot.docs.map(async (bookingDoc) => {
      let lockedBooking;

      await admin.firestore().runTransaction(async (transaction) => {
        const freshSnapshot = await transaction.get(bookingDoc.ref);
        const booking = freshSnapshot.data();

        if (!booking) {
          return;
        }

        if (booking.status !== 'confirmed') {
          return;
        }

        if (booking.reminderSmsSent === true) {
          return;
        }

        if (isRecentReminderLock(booking.reminderSmsProcessingAt, now)) {
          return;
        }

        const appointmentMinutes = getTimeMinutes(booking.bookingTime);

        if (!booking.bookingDate || appointmentMinutes === null) {
          return;
        }

        const isLaterToday =
          booking.bookingDate === currentDate &&
          appointmentMinutes > currentMinutes;
        const isWithinNextDayWindow =
          booking.bookingDate === tomorrowDate &&
          appointmentMinutes <= currentMinutes;

        if (!isLaterToday && !isWithinNextDayWindow) {
          return;
        }

        const normalizedPhone = normalizeAustralianPhoneNumber(booking.phone);

        lockedBooking = {
          ...booking,
          phone: normalizedPhone,
        };

        transaction.update(bookingDoc.ref, {
          phone: normalizedPhone,
          reminderSmsProcessingAt: now.toISOString(),
        });
      });

      if (!lockedBooking) {
        return;
      }

      try {
        await sendSmsMessage(
          lockedBooking.phone,
          buildReminderSmsMessage(lockedBooking)
        );

        await bookingDoc.ref.update({
          phone: lockedBooking.phone,
          reminderSmsSent: true,
          reminderSmsSentAt: new Date().toISOString(),
          reminderSmsProcessingAt: admin.firestore.FieldValue.delete(),
        });
      } catch (error) {
        console.error('sendBookingReminderSms job failed:', {
          bookingId: bookingDoc.id,
          code: error?.code || 'unknown',
          message: error?.message || 'Unknown reminder SMS error',
        });

        await bookingDoc.ref.update({
          reminderSmsProcessingAt: admin.firestore.FieldValue.delete(),
        });
      }
    });

    await Promise.all(sendJobs);
  }
);

exports._internal = {
  buildApprovalSmsMessage,
  buildReminderSmsMessage,
  normalizeAustralianPhoneNumber,
};
