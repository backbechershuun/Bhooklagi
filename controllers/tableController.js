import Table from "../models/Table.js";
import Restaurant from "../models/Restaurant.js";
import Booking from "../models/Booking.js";
import { buildOverlapQuery } from "../utils/bookingWindow.js";

const ensureOwnership = async (restaurantId, userId, userRole) => {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) return { error: "Restaurant not found", status: 404 };
  if (restaurant.owner.toString() !== userId.toString() && userRole !== "admin") {
    return { error: "Not authorized for this restaurant", status: 403 };
  }
  return { restaurant };
};

export const addTable = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const check = await ensureOwnership(restaurantId, req.user._id, req.user.role);
    if (check.error) return res.status(check.status).json({ message: check.error });

    const table = await Table.create({ ...req.body, restaurant: restaurantId });
    res.status(201).json(table);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Table number already exists for this restaurant" });
    }
    res.status(500).json({ message: err.message });
  }
};

export const getTablesByRestaurant = async (req, res) => {
  try {
    const tables = await Table.find({ restaurant: req.params.restaurantId, isActive: true });
    res.json(tables);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/tables/:restaurantId/availability?date=2026-09-12&timeSlot=19:00&partySize=4
//
// A table is unavailable if any ACTIVE booking (pending, pending_payment, or
// confirmed) on it has a 3-hour hold window overlapping the requested slot.
// "completed" and "cancelled" bookings never block — so once an owner marks
// a booking completed, the table frees up immediately even if the 3-hour
// window hasn't elapsed yet.
export const getAvailableTables = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { date, timeSlot, partySize } = req.query;

    if (!date || !timeSlot) {
      return res.status(400).json({ message: "date and timeSlot are required query params" });
    }

    const tableFilter = { restaurant: restaurantId, isActive: true };
    if (partySize) tableFilter.capacity = { $gte: Number(partySize) };

    const allTables = await Table.find(tableFilter);
    if (allTables.length === 0) return res.json([]);

    // Overlap window depends on each existing booking's own start time, so
    // this is built per-table rather than as a single flat query.
    const bookedTableIds = await Booking.find({
      restaurant: restaurantId,
      $or: allTables.map((t) => buildOverlapQuery({ table: t._id, date, timeSlot })),
    }).distinct("table");

    const bookedSet = new Set(bookedTableIds.map((id) => id.toString()));
    const availableTables = allTables.filter((t) => !bookedSet.has(t._id.toString()));

    res.json(availableTables);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Updates just the hotspot position of an existing table on its interior photo
export const updateTablePosition = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: "Table not found" });

    const check = await ensureOwnership(table.restaurant, req.user._id, req.user.role);
    if (check.error) return res.status(check.status).json({ message: check.error });

    const { positionX, positionY } = req.body;
    table.positionX = positionX ?? table.positionX;
    table.positionY = positionY ?? table.positionY;
    await table.save();

    res.json(table);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteTable = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: "Table not found" });

    const check = await ensureOwnership(table.restaurant, req.user._id, req.user.role);
    if (check.error) return res.status(check.status).json({ message: check.error });

    await table.deleteOne();
    res.json({ message: "Table removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};