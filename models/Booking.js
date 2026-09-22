import mongoose from "mongoose";
import { toBookingStart } from "../utils/bookingWindow.js";

const bookingItemSchema = new mongoose.Schema(
  {
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },
    name: { type: String, required: true },
    portion: { type: String, enum: ["half", "full"] }, // omitted for non-portioned items
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
    },
    date: { type: String, required: true },
    timeSlot: { type: String, required: true },
    partySize: { type: Number, required: true },
    specialRequest: { type: String },

    // Menu-first checkout flow fields
    items: [bookingItemSchema],
    subtotal: { type: Number },
    depositPercent: { type: Number },
    depositAmount: { type: Number },

    // Razorpay fields
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    paidAt: { type: Date },
    refundedAt: { type: Date },

    // Real Date derived from date + timeSlot, used for the 3-hour hold
    // overlap query. Kept in sync automatically — see pre("validate") below.
    bookingStart: { type: Date },

    status: {
      type: String,
      enum: ["pending", "pending_payment", "confirmed", "cancelled", "completed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

bookingSchema.pre("validate", function (next) {
  if (this.date && this.timeSlot) {
    this.bookingStart = toBookingStart(this.date, this.timeSlot);
  }
  next();
});


bookingSchema.index(
  { table: 1, date: 1, timeSlot: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "pending_payment", "confirmed"] },
    },
  }
);

// Guards against "Cannot overwrite model" crashes — serverless functions on
// Vercel can re-import this module across invocations, and mongoose throws
// if you call .model() with the same name twice in one process.
const Booking = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

export default Booking;