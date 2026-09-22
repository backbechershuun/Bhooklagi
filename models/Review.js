import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

reviewSchema.index({ booking: 1 }, { unique: true });

// Guards against "Cannot overwrite model" crashes — serverless functions on
// Vercel can re-import this module across invocations, and mongoose throws
// if you call .model() with the same name twice in one process.
const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);

export default Review;