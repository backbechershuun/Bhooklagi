import mongoose from "mongoose";

const tableSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    tableNumber: { type: String, required: true },
    capacity: { type: Number, required: true, min: 1 },
    location: { type: String, enum: ["indoor", "outdoor", "rooftop", "private"], default: "indoor" },
    isActive: { type: Boolean, default: true }, // owner can disable a table
    positionX: { type: Number, default: null }, // 0–100, % across the interior photo
    positionY: { type: Number, default: null }, // 0–100, % down the interior photo
  },
  { timestamps: true }
);

tableSchema.index({ restaurant: 1, tableNumber: 1 }, { unique: true });

// Guards against "Cannot overwrite model" crashes — serverless functions on
// Vercel can re-import this module across invocations, and mongoose throws
// if you call .model() with the same name twice in one process.
const Table = mongoose.models.Table || mongoose.model("Table", tableSchema);

export default Table;