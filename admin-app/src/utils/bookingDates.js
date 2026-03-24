const BUSINESS_TIME_ZONE = 'Australia/Sydney';

export function getBusinessTodayParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);

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

export function getBusinessTodayDateString(date = new Date()) {
  const today = getBusinessTodayParts(date);
  return `${today.year}-${String(today.month).padStart(2, '0')}-${String(
    today.day
  ).padStart(2, '0')}`;
}

export function isToday(dateString) {
  if (!dateString) return false;
  return dateString === getBusinessTodayDateString();
}

export function isBeforeToday(dateString) {
  if (!dateString) return false;
  return dateString < getBusinessTodayDateString();
}
