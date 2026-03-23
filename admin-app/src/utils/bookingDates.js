const BUSINESS_TIME_ZONE = 'Australia/Sydney';

export function getBusinessTodayParts() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  };
}

export function parseBookingDateParts(dateString) {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return null;
  }

  const [year, month, day] = dateString.split('-').map(Number);

  return { year, month, day };
}

export function isToday(dateString) {
  const bookingDate = parseBookingDateParts(dateString);

  if (!bookingDate) return false;

  const today = getBusinessTodayParts();

  return (
    bookingDate.year === today.year &&
    bookingDate.month === today.month &&
    bookingDate.day === today.day
  );
}

export function isBeforeToday(dateString) {
  const bookingDate = parseBookingDateParts(dateString);

  if (!bookingDate) return false;

  const today = getBusinessTodayParts();
  const bookingValue = Number(
    `${bookingDate.year}${String(bookingDate.month).padStart(2, '0')}${String(
      bookingDate.day
    ).padStart(2, '0')}`
  );
  const todayValue = Number(
    `${today.year}${String(today.month).padStart(2, '0')}${String(
      today.day
    ).padStart(2, '0')}`
  );

  return bookingValue < todayValue;
}
