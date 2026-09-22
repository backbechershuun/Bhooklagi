import mongoose from "mongoose";

const restaurantSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    cuisine: [{ type: String, trim: true }],
    address: { type: String, required: true },
    city: { type: String, required: true, index: true },
    priceRange: { type: String, enum: ["$", "$$", "$$$", "$$$$"], default: "$$" },
    openingTime: { type: String, default: "10:00" },
    closingTime: { type: String, default: "22:00" },
    image: { type: String },          // EXTERIOR photo (existing, unchanged)
    interiorImage: { type: String },  // NEW — INTERIOR photo
    rating: {
      type: Number,
      default: 0,
    },
    numReviews: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

restaurantSchema.index({ name: "text", city: "text", cuisine: "text" });

// Guards against "Cannot overwrite model" crashes — serverless functions on
// Vercel can re-import this module across invocations, and mongoose throws
// if you call .model() with the same name twice in one process.
const Restaurant = mongoose.models.Restaurant || mongoose.model("Restaurant", restaurantSchema);

export default Restaurant;