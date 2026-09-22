import MenuItem from "./models/MenuItem.js";
import Restaurant from "../models/Restaurant.js";

// GET /menu/:restaurantId  — public, used on the booking/food-order page
export const getMenu = async (req, res) => {
  try {
    const items = await MenuItem.find({
      restaurant: req.params.restaurantId,
      available: true,
    }).sort({ category: 1, name: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const assertOwnerOrAdmin = async (restaurantId, user) => {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    const err = new Error("Restaurant not found");
    err.status = 404;
    throw err;
  }
  if (restaurant.owner.toString() !== user._id.toString() && user.role !== "admin") {
    const err = new Error("Not authorized");
    err.status = 403;
    throw err;
  }
  return restaurant;
};

// POST /menu/:restaurantId  — owner adds a dish
export const addMenuItem = async (req, res) => {
  try {
    await assertOwnerOrAdmin(req.params.restaurantId, req.user);
    const { name, category, price, veg, description } = req.body;

    if (!name || price == null) {
      return res.status(400).json({ message: "name and price are required" });
    }

    const item = await MenuItem.create({
      restaurant: req.params.restaurantId,
      name,
      category,
      price,
      veg,
      description,
    });

    res.status(201).json(item);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// PUT /menu/item/:itemId  — owner edits a dish
export const updateMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.itemId);
    if (!item) return res.status(404).json({ message: "Menu item not found" });

    await assertOwnerOrAdmin(item.restaurant, req.user);

    Object.assign(item, req.body);
    await item.save();
    res.json(item);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// DELETE /menu/item/:itemId  — owner removes a dish
export const deleteMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.itemId);
    if (!item) return res.status(404).json({ message: "Menu item not found" });

    await assertOwnerOrAdmin(item.restaurant, req.user);

    await item.deleteOne();
    res.json({ message: "Menu item removed" });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};