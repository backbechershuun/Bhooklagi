import express from "express";
import upload from "../config/multer.js";
import cloudinary from "../config/cloudinary.js";
import MenuItem from "../models/MenuItem.js";

const router = express.Router();

// Menu photos are uploaded straight to Cloudinary (see config/multer.js and
// config/cloudinary.js) instead of being saved to the local disk, since
// Vercel's serverless filesystem is read-only and wipes /tmp between requests.

// Turns the submitted form fields into the price fields MenuItem expects,
// handling both the single-price case and the half/full-portion case.
const buildPricing = (body) => {
  const hasPortions = body.hasPortions === "true" || body.hasPortions === true;

  if (hasPortions) {
    const halfPrice = Number(body.halfPrice);
    const fullPrice = Number(body.fullPrice);
    if (Number.isNaN(halfPrice) || Number.isNaN(fullPrice)) {
      throw new Error("Half and full prices are required when portions are enabled");
    }
    return { hasPortions: true, halfPrice, fullPrice, price: fullPrice };
  }

  const price = Number(body.price);
  if (Number.isNaN(price)) {
    throw new Error("Price is required");
  }
  return { hasPortions: false, halfPrice: undefined, fullPrice: undefined, price };
};

// Deletes an image from Cloudinary given its full secure URL, so old menu
// photos don't pile up in your Cloudinary account when items are updated
// or removed. Safe to call with a non-Cloudinary or empty URL — it just
// logs and moves on.
const deleteCloudinaryImage = async (imageUrl) => {
  if (!imageUrl || !imageUrl.includes("res.cloudinary.com")) return;

  try {
    // e.g. https://res.cloudinary.com/<cloud>/image/upload/v123/restaurant-app/abc123.jpg
    // -> public_id is "restaurant-app/abc123"
    const parts = imageUrl.split("/");
    const fileName = parts.pop();
    const folder = parts.pop();
    const publicId = `${folder}/${fileName.split(".")[0]}`;

    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary delete error:", error);
  }
};

/*
|--------------------------------------------------------------------------
| GET MENU
|--------------------------------------------------------------------------
| GET /api/menu/:restaurantId
*/
router.get("/:restaurantId", async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const menuItems = await MenuItem.find({
      restaurant: restaurantId,
    }).sort({
      category: 1,
      createdAt: -1,
    });

    res.json(menuItems);
  } catch (error) {
    console.error("Get menu error:", error);

    res.status(500).json({
      message: "Failed to fetch menu",
    });
  }
});

/*
|--------------------------------------------------------------------------
| ADD MENU ITEM
|--------------------------------------------------------------------------
| POST /api/menu/:restaurantId
*/
router.post("/:restaurantId", upload.single("image"), async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name, description, category, foodType, isAvailable } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        message: "Name and category are required",
      });
    }

    let pricing;
    try {
      pricing = buildPricing(req.body);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    const menuItem = await MenuItem.create({
      restaurant: restaurantId,
      name,
      description,
      category,
      foodType,
      ...pricing,
      // req.file.path is the Cloudinary secure URL once multer-storage-cloudinary runs
      image: req.file ? req.file.path : req.body.image || "",
      isAvailable:
        isAvailable === "false" ? false : typeof isAvailable === "boolean" ? isAvailable : true,
    });

    res.status(201).json(menuItem);
  } catch (error) {
    console.error("Add menu item error:", error);

    res.status(500).json({
      message: "Failed to add menu item",
    });
  }
});

/*
|--------------------------------------------------------------------------
| UPDATE MENU ITEM
|--------------------------------------------------------------------------
| PUT /api/menu/item/:itemId
*/
router.put("/item/:itemId", upload.single("image"), async (req, res) => {
  try {
    const { itemId } = req.params;
    const { name, description, category, foodType, isAvailable } = req.body;

    let pricing;
    try {
      pricing = buildPricing(req.body);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    const update = {
      name,
      description,
      category,
      foodType,
      ...pricing,
      isAvailable: isAvailable === "false" ? false : isAvailable === "true" ? true : undefined,
    };

    // If a new image was uploaded, swap it in and clean up the old one
    // from Cloudinary once we know the update succeeded.
    let oldImageUrl;
    if (req.file) {
      const existing = await MenuItem.findById(itemId).select("image");
      oldImageUrl = existing?.image;
      update.image = req.file.path;
    }

    // Clear out any keys that weren't actually sent, so we don't blank
    // fields the owner didn't touch.
    Object.keys(update).forEach((key) => update[key] === undefined && delete update[key]);
    // hasPortions can legitimately be false, so re-add it if buildPricing set it.
    if (pricing.hasPortions === false) update.hasPortions = false;
    if (!pricing.hasPortions) {
      update.halfPrice = undefined;
      update.fullPrice = undefined;
    }

    const updatedItem = await MenuItem.findByIdAndUpdate(itemId, update, {
      new: true,
      runValidators: true,
    });

    if (!updatedItem) {
      return res.status(404).json({
        message: "Menu item not found",
      });
    }

    if (oldImageUrl) await deleteCloudinaryImage(oldImageUrl);

    res.json(updatedItem);
  } catch (error) {
    console.error("Update menu item error:", error);

    res.status(500).json({
      message: "Failed to update menu item",
    });
  }
});

/*
|--------------------------------------------------------------------------
| DELETE MENU ITEM
|--------------------------------------------------------------------------
| DELETE /api/menu/item/:itemId
*/
router.delete("/item/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;

    const deletedItem = await MenuItem.findByIdAndDelete(itemId);

    if (!deletedItem) {
      return res.status(404).json({
        message: "Menu item not found",
      });
    }

    await deleteCloudinaryImage(deletedItem.image);

    res.json({
      message: "Menu item deleted successfully",
    });
  } catch (error) {
    console.error("Delete menu item error:", error);

    res.status(500).json({
      message: "Failed to update availability",
    });
  }
});

/*
|--------------------------------------------------------------------------
| TOGGLE AVAILABILITY
|--------------------------------------------------------------------------
| PATCH /api/menu/item/:itemId/availability
*/
router.patch("/item/:itemId/availability", async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await MenuItem.findById(itemId);

    if (!item) {
      return res.status(404).json({
        message: "Menu item not found",
      });
    }

    item.isAvailable = !item.isAvailable;

    await item.save();

    res.json(item);
  } catch (error) {
    console.error("Toggle availability error:", error);

    res.status(500).json({
      message: "Failed to update availability",
    });
  }
});

export default router;