// A confirmed/pending booking holds its table for this many hours.
export const BOOKING_HOLD_HOURS = 3;

// Combines the stored date ("YYYY-MM-DD") + timeSlot ("HH:00") strings into
// a real Date. Centralized here so every controller/model parses them the same way.
export const toBookingStart = (date, timeSlot) => new Date(`${date}T${timeSlot}:00`);

// Statuses that still occupy a table (i.e. haven't been cancelled/completed).
export const ACTIVE_BOOKING_STATUSES = ["pending", "pending_payment", "confirmed"];

// Builds the Mongo query fragment that finds any ACTIVE booking on `table`
// whose 3-hour hold window overlaps the requested slot's 3-hour window.
// Two windows [s1, s1+3h) and [s2, s2+3h) overlap iff s1 < s2+3h AND s2 < s1+3h.
export const buildOverlapQuery = ({ table, date, timeSlot, excludeBookingId }) => {
  const requestedStart = toBookingStart(date, timeSlot);
  const holdMs = BOOKING_HOLD_HOURS * 60 * 60 * 1000;

  const query = {
    table,
    status: { $in: ACTIVE_BOOKING_STATUSES },
    bookingStart: {
      $lt: new Date(requestedStart.getTime() + holdMs),
      $gt: new Date(requestedStart.getTime() - holdMs),
    },
  };
  if (excludeBookingId) query._id = { $ne: excludeBookingId };
  return query;
};