export const BUSINESS_TIME_ZONE = 'Australia/Sydney';

export function parseBusinessDateString(dateString) {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return null;
  }

  const [year, month, day] = dateString.split('-').map(Number);
  return { year, month, day };
}

export function getSydneyNow() {
  return new Date();
}

export function getSydneyNowParts(date = new Date()) {
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

export function getBusinessDateStringFromParts(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(
    parts.day
  ).padStart(2, '0')}`;
}

export function getSydneyTodayDateString() {
  return getBusinessDateStringFromParts(getSydneyNowParts());
}

export function getSydneyNowMinutes(date = new Date()) {
  const parts = getSydneyNowParts(date);
  return parts.hour * 60 + parts.minute;
}

export function isDateWithinRange(dateString, startDate, endDate) {
  if (!dateString || !startDate || !endDate) return false;
  return dateString >= startDate && dateString <= endDate;
}

export function closureAppliesToDate(closure, dateString) {
  return isDateWithinRange(dateString, closure.startDate, closure.endDate);
}

export function getFullDayClosureForDate(closures, dateString) {
  return closures.find(
    (closure) => closure.isFullDay && closureAppliesToDate(closure, dateString)
  );
}

export function getPartialDayClosuresForDate(closures, dateString) {
  return closures.filter(
    (closure) => !closure.isFullDay && closureAppliesToDate(closure, dateString)
  );
}

export function getBusinessHours(dateString) {
  if (!dateString) return null;
  const day = getBusinessDayOfWeek(dateString);
  if (day === 0) return null;
  if (day >= 1 && day <= 3) return { start: '09:00', end: '18:00' };
  if (day === 4) return { start: '09:00', end: '19:00' };
  if (day === 5) return { start: '09:00', end: '18:00' };
  return { start: '09:00', end: '17:00' };
}

export function getBusinessDayOfWeek(dateString) {
  const parsed = parseBusinessDateString(dateString);

  if (!parsed) return null;

  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12)).getUTCDay();
}

export function timeToMinutes(time) {
  const [hours, minutes] = String(time || '')
    .split(':')
    .map(Number);
  return hours * 60 + minutes;
}

export function formatBusinessTimeLabel(time24) {
  if (!time24) return 'Not selected';

  const [hours, minutes] = String(time24)
    .split(':')
    .map(Number);

  if ([hours, minutes].some((value) => Number.isNaN(value))) {
    return 'Not selected';
  }

  const period = hours >= 12 ? 'pm' : 'am';
  const hour12 = hours % 12 || 12;

  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function shiftBusinessDateString(dateString, days) {
  const parsed = parseBusinessDateString(dateString);

  if (!parsed || !Number.isFinite(days)) return '';

  const utcDate = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day + days, 12)
  );

  return `${utcDate.getUTCFullYear()}-${String(
    utcDate.getUTCMonth() + 1
  ).padStart(2, '0')}-${String(utcDate.getUTCDate()).padStart(2, '0')}`;
}

export function formatBusinessDateLabel(dateString) {
  const parsed = parseBusinessDateString(dateString);

  if (!parsed) return 'Not selected';

  return new Intl.DateTimeFormat('en-AU', {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12)));
}

export function isBusinessToday(dateString) {
  if (!dateString) return false;
  return dateString === getSydneyTodayDateString();
}

export function isBusinessDateBeforeToday(dateString) {
  if (!dateString) return false;
  return dateString < getSydneyTodayDateString();
}

export function getCurrentBusinessStatus({
  vacationMode = false,
  scheduledClosures = [],
  now = new Date(),
} = {}) {
  const currentParts = getSydneyNowParts(now);
  const currentDate = getBusinessDateStringFromParts(currentParts);

  if (vacationMode) {
    return {
      isOpen: false,
      reason: 'closed_vacation_mode',
    };
  }

  const fullDayClosure = getFullDayClosureForDate(scheduledClosures, currentDate);
  if (fullDayClosure) {
    return {
      isOpen: false,
      reason: 'closed_full_day_closure',
      closure: fullDayClosure,
    };
  }

  const businessHours = getBusinessHours(currentDate);
  if (!businessHours) {
    return {
      isOpen: false,
      reason: 'closed_outside_hours',
    };
  }

  const currentMinutes = currentParts.hour * 60 + currentParts.minute;
  const businessStart = timeToMinutes(businessHours.start);
  const businessEnd = timeToMinutes(businessHours.end);

  if (currentMinutes < businessStart || currentMinutes >= businessEnd) {
    return {
      isOpen: false,
      reason: 'closed_outside_hours',
    };
  }

  const partialClosures = getPartialDayClosuresForDate(
    scheduledClosures,
    currentDate
  );
  const activePartialClosure = partialClosures.find((closure) => {
    if (!closure?.startTime || !closure?.endTime) return false;
    const startMinutes = timeToMinutes(closure.startTime);
    const endMinutes = timeToMinutes(closure.endTime);
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  });

  if (activePartialClosure) {
    return {
      isOpen: false,
      reason: 'closed_partial_day_closure',
      closure: activePartialClosure,
    };
  }

  return {
    isOpen: true,
    reason: 'open_by_hours',
  };
}
