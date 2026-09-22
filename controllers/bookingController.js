import Razorpay from "razorpay";
import crypto from "crypto";
import Booking from "../models/Booking.js";
import Table from "../models/Table.js";
import Restaurant from "../models/Restaurant.js";
import MenuItem from "../models/MenuItem.js";
import { buildOverlapQuery } from "../utils/bookingWindow.js";

// Built lazily (on first use, not at import time) so it doesn't matter
// whether dotenv has finished loading by the time this module is imported —
// with ES modules, import side effects can run before later lines in your
// entry file, including dotenv.config().
let razorpay;
const getRazorpay = () => {
  if (!razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set in the environment");
    }
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpay;
};

// Guests may pay this percentage now, or pay the full order in one go.
// Never anything in between, and never less than this — this is the
// server-side floor and is NOT trusted from the client.
const MIN_DEPOSIT_PERCENT = 40;

export const createBooking = async (req, res) => {
  try {
    const { restaurantId, tableId, date, timeSlot, partySize, specialRequest } = req.body;

    if (!restaurantId || !tableId || !date || !timeSlot || !partySize) {
      return res.status(400).json({ message: "restaurantId, tableId, date, timeSlot and partySize are required" });
    }

    const table = await Table.findById(tableId);
    if (!table || table.restaurant.toString() !== restaurantId) {
      return res.status(404).json({ message: "Table not found for this restaurant" });
    }
    if (partySize > table.capacity) {
      return res.status(400).json({ message: `This table seats up to ${table.capacity} guests` });
    }

    // 3-hour overlap check, not exact date+timeSlot match — see bookingWindow.js
    const conflict = await Booking.findOne(buildOverlapQuery({ table: tableId, date, timeSlot }));
    if (conflict) {
      return res.status(409).json({ message: "This table is already booked around that time" });
    }

    const booking = await Booking.create({
      user: req.user._id,
      restaurant: restaurantId,
      table: tableId,
      date,
      timeSlot,
      partySize,
      specialRequest,
      status: "pending",
    });

    res.status(201).json(booking);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "This table is already booked for that date and time" });
    }
    res.status(500).json({ message: err.message });
  }
};

// POST /bookings/checkout
// Menu-first booking flow: creates a "pending_payment" booking holding the
// table + chosen dishes, then a Razorpay order for either a 40% deposit or
// the full amount, depending on the "payFull" flag. The table isn't
// actually locked in as booked until verifyPayment confirms it.
//
// depositPercent is NEVER taken from the client as a raw number — only a
// payFull boolean is accepted, and the server decides the actual percent
// (40 or 100). This keeps the 40% floor from being bypassed by a client
// sending an arbitrary depositPercent value.
export const startCheckout = async (req, res) => {
  try {
    const { restaurantId, tableId, date, timeSlot, partySize, items, specialRequest, payFull } = req.body;

    if (!restaurantId || !tableId || !date || !timeSlot || !partySize) {
      return res.status(400).json({ message: "restaurantId, tableId, date, timeSlot and partySize are required" });
    }
    if (!items?.length) {
      return res.status(400).json({ message: "Add at least one menu item to book this table" });
    }

    const table = await Table.findById(tableId);
    if (!table || table.restaurant.toString() !== restaurantId) {
      return res.status(404).json({ message: "Table not found for this restaurant" });
    }
    if (partySize > table.capacity) {
      return res.status(400).json({ message: `This table seats up to ${table.capacity} guests` });
    }

    // 3-hour overlap check, not exact date+timeSlot match — see bookingWindow.js
    const conflict = await Booking.findOne(buildOverlapQuery({ table: tableId, date, timeSlot }));
    if (conflict) {
      return res.status(409).json({ message: "This table is already booked around that time" });
    }

    const menuItems = await MenuItem.find({
      _id: { $in: items.map((i) => i.menuItemId) },
      restaurant: restaurantId,
    });

    const orderItems = items.map(({ menuItemId, quantity, portion }) => {
      const menuItem = menuItems.find((m) => m._id.toString() === menuItemId);
      if (!menuItem) throw new Error("One of the selected dishes is no longer available");

      let price = menuItem.price;
      if (menuItem.hasPortions) {
        if (portion !== "half" && portion !== "full") {
          throw new Error(`${menuItem.name} requires a half or full portion to be selected`);
        }
        price = portion === "half" ? menuItem.halfPrice : menuItem.fullPrice;
      }

      return {
        menuItem: menuItem._id,
        name: menuItem.name,
        portion: menuItem.hasPortions ? portion : undefined,
        price,
        quantity,
      };
    });

    const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // Only a boolean is trusted from the client. The percent itself is
    // always decided here, so it can never drop below MIN_DEPOSIT_PERCENT.
    const depositPercent = payFull === true ? 100 : MIN_DEPOSIT_PERCENT;
    const depositAmount = Math.ceil((subtotal * depositPercent) / 100);

    const booking = await Booking.create({
      user: req.user._id,
      restaurant: restaurantId,
      table: tableId,
      date,
      timeSlot,
      partySize,
      specialRequest,
      items: orderItems,
      subtotal,
      depositPercent,
      depositAmount,
      status: "pending_payment",
    });

    let razorpayOrder;
    try {
      razorpayOrder = await getRazorpay().orders.create({
        amount: depositAmount * 100, // paise
        currency: "INR",
        receipt: booking._id.toString(),
      });
    } catch (payErr) {
      // Don't leave an orphaned hold on the table if the payment order fails.
      await Booking.findByIdAndDelete(booking._id);
      throw payErr;
    }

    booking.razorpayOrderId = razorpayOrder.id;
    await booking.save();

    res.status(201).json({
      bookingId: booking._id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      depositPercent,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "This table is already booked for that date and time" });
    }
    res.status(500).json({ message: err.message || "Could not start checkout" });
  }
};

// POST /bookings/:id/verify
// Verifies the Razorpay signature server-side, then moves the booking to
// "pending" — payment is captured, but the table isn't confirmed until the
// restaurant owner accepts it from their dashboard. Owner then moves it to
// "confirmed" or "cancelled" (with automatic refund — see updateBookingStatus).
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, razorpayOrderId: razorpay_order_id, user: req.user._id },
      {
        status: "pending", // paid, awaiting owner confirmation — NOT auto-confirmed
        razorpayPaymentId: razorpay_payment_id,
        paidAt: new Date(),
      },
      { new: true }
    );

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    res.json({ message: "Payment received — awaiting restaurant confirmation", booking });
  } catch (err) {
    res.status(500).json({ message: err.message || "Could not verify payment" });
  }
};

export const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate("restaurant", "name city address")
      .populate("table", "tableNumber capacity")
      .sort({ date: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// For restaurant owners: all bookings for a restaurant they own
export const getRestaurantBookings = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.restaurantId);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });
    if (restaurant.owner.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const bookings = await Booking.find({ restaurant: req.params.restaurantId })
      .populate("user", "name email phone")
      .populate("table", "tableNumber capacity")
      .sort({ date: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// confirmed | cancelled | completed
//
// Cancelling a booking that already has a captured payment (razorpayPaymentId
// + depositAmount both set — i.e. it went through the paid checkout flow)
// triggers an automatic Razorpay refund of the deposit before the status
// flips. If the refund call fails, the cancellation is rejected (booking
// stays as-is) rather than silently leaving an unrefunded payment behind —
// so the guest/owner sees an error and can retry or contact support.
//
// NOTE: this currently refunds the full deposit regardless of whether the
// GUEST or the OWNER initiated the cancellation. If you want guest-initiated
// cancellations to forfeit the deposit (common, to discourage no-shows) while
// owner-rejections are always refunded, split this on `isOwner` vs
// `isBookingUser` — flag it and I'll add that.
export const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id).populate("restaurant");
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const isOwner = booking.restaurant.owner.toString() === req.user._id.toString();
    const isBookingUser = booking.user.toString() === req.user._id.toString();

    if (status === "cancelled" && (isBookingUser || isOwner || req.user.role === "admin")) {
      if (booking.razorpayPaymentId && booking.depositAmount) {
        try {
          await getRazorpay().payments.refund(booking.razorpayPaymentId, {
            amount: booking.depositAmount * 100, // paise
          });
          booking.refundedAt = new Date();
        } catch (refundErr) {
          return res.status(502).json({
            message: "Could not process refund automatically. Please contact support.",
            detail: refundErr.message,
          });
        }
      }
      booking.status = "cancelled";
    } else if (isOwner || req.user.role === "admin") {
      booking.status = status;
    } else {
      return res.status(403).json({ message: "Not authorized to update this booking" });
    }

    await booking.save();
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};