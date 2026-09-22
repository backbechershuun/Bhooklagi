import mongoose from "mongoose";

const menuItemSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    // Used when the dish has a single price (no half/full split).
    // When hasPortions is true, this mirrors fullPrice so any older code
    // that just reads item.price keeps working.
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    hasPortions: {
      type: Boolean,
      default: false,
    },
    halfPrice: {
      type: Number,
      min: 0,
    },
    fullPrice: {
      type: Number,
      min: 0,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    foodType: {
      type: String,
      enum: ["veg", "non-veg", "egg"],
      default: "veg",
    },

    image: {
      type: String,
      default: "",
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Guards against "Cannot overwrite model" crashes if this file ever gets
// loaded twice under different casing (e.g. MenuItem.js vs Menuitem.js on a
// case-insensitive filesystem being treated as two separate modules by Node).
const MenuItem = mongoose.models.MenuItem || mongoose.model("MenuItem", menuItemSchema);

export default MenuItem;