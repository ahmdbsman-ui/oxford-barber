import { isBeforeToday, isToday } from './bookingDates';

function getRevenue(bookings) {
  return bookings
    .filter(
      (booking) =>
        booking.status === 'confirmed' || booking.status === 'completed'
    )
    .reduce((sum, booking) => sum + (Number(booking.price) || 0), 0);
}

function normalizeStatus(status) {
  return String(status || 'pending').toLowerCase();
}

function sortByLabelAscending(entries) {
  return entries.sort((left, right) => left.label.localeCompare(right.label));
}

export function getBookingStats(bookings) {
  return {
    total: bookings.length,
    today: bookings.filter((booking) => isToday(booking.bookingDate)).length,
    pending: bookings.filter((booking) => booking.status === 'pending').length,
    confirmed: bookings.filter((booking) => booking.status === 'confirmed')
      .length,
    revenue: getRevenue(bookings),
  };
}

export function getActiveBookings(bookings) {
  return bookings.filter((booking) => {
    const status = booking.status || 'pending';

    return (
      status !== 'completed' &&
      status !== 'cancelled' &&
      !isBeforeToday(booking.bookingDate)
    );
  });
}

export function getHistoryBookings(bookings) {
  return bookings.filter((booking) => {
    const status = booking.status || 'pending';

    return (
      status === 'completed' ||
      status === 'cancelled' ||
      isBeforeToday(booking.bookingDate)
    );
  });
}

export function getStatusChartData(bookings) {
  const statusCounts = bookings.reduce((accumulator, booking) => {
    const status = normalizeStatus(booking.status);
    accumulator[status] = (accumulator[status] || 0) + 1;
    return accumulator;
  }, {});

  return [
    { name: 'Pending', value: statusCounts.pending || 0, fill: '#d6a748' },
    { name: 'Confirmed', value: statusCounts.confirmed || 0, fill: '#82efb6' },
    { name: 'Completed', value: statusCounts.completed || 0, fill: '#6fb1ff' },
    { name: 'Cancelled', value: statusCounts.cancelled || 0, fill: '#ff9797' },
  ];
}

export function getBookingsPerDayChartData(bookings) {
  const grouped = bookings.reduce((accumulator, booking) => {
    const label = booking.bookingDate || 'Unknown';
    accumulator[label] = (accumulator[label] || 0) + 1;
    return accumulator;
  }, {});

  return sortByLabelAscending(
    Object.entries(grouped).map(([label, value]) => ({
      label,
      bookings: value,
    }))
  ).slice(-7);
}

export function getRevenueTrendChartData(bookings) {
  const grouped = bookings.reduce((accumulator, booking) => {
    const status = normalizeStatus(booking.status);

    if (status !== 'confirmed' && status !== 'completed') {
      return accumulator;
    }

    const label = booking.bookingDate || 'Unknown';
    accumulator[label] = (accumulator[label] || 0) + (Number(booking.price) || 0);
    return accumulator;
  }, {});

  return sortByLabelAscending(
    Object.entries(grouped).map(([label, value]) => ({
      label,
      revenue: value,
    }))
  ).slice(-7);
}
