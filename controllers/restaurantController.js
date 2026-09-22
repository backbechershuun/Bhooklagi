import Restaurant from "../models/Restaurant.js";
import { deleteCloudinaryImage } from "../utils/cloudinary.js";

export const createRestaurant = async (req, res) => {
  try {
    const { name, city, address, description, priceRange, openingTime, closingTime } = req.body;

    // cuisine arrives as a string if only one value was sent, or an array
    // if multiple — normalize either case
    const cuisine = Array.isArray(req.body.cuisine)
      ? req.body.cuisine
      : req.body.cuisine
      ? [req.body.cuisine]
      : [];

    // req.files.image[0].path is the Cloudinary secure URL once
    // multer-storage-cloudinary processes the upload
    const imagePath = req.files?.image?.[0]?.path || null;

    const restaurant = await Restaurant.create({
      name,
      city,
      address,
      description,
      cuisine,
      priceRange,
      openingTime,
      closingTime,
      image: imagePath,
      owner: req.user._id, // from `protect` middleware
    });

    res.status(201).json(restaurant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get restaurants owned by the logged-in user
// @route   GET /api/restaurants/mine
// @access  Private (owner)
export const getMyRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json(restaurants);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getRestaurants = async (req, res) => {
  try {
    const { city, cuisine, search } = req.query;
    const filter = {};

    if (city) filter.city = new RegExp(city, "i");
    if (cuisine) filter.cuisine = { $in: [new RegExp(cuisine, "i")] };
    if (search) filter.$text = { $search: search };

    const restaurants = await Restaurant.find(filter).sort({ rating: -1 });
    res.json(restaurants);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getRestaurantById = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

    if (restaurant.owner.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to edit this restaurant" });
    }

    // Track old images so we can delete them from Cloudinary after the
    // update succeeds, and swap in the new Cloudinary URLs.
    const oldImage = restaurant.image;
    const oldInteriorImage = restaurant.interiorImage;

    if (req.files?.image?.[0]) {
      req.body.image = req.files.image[0].path;
    }
    if (req.files?.interiorImage?.[0]) {
      req.body.interiorImage = req.files.interiorImage[0].path;
    }

    Object.assign(restaurant, req.body);
    await restaurant.save();

    if (req.files?.image?.[0] && oldImage) await deleteCloudinaryImage(oldImage);
    if (req.files?.interiorImage?.[0] && oldInteriorImage) {
      await deleteCloudinaryImage(oldInteriorImage);
    }

    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

    if (restaurant.owner.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this restaurant" });
    }

    await restaurant.deleteOne();

    await deleteCloudinaryImage(restaurant.image);
    await deleteCloudinaryImage(restaurant.interiorImage);

    res.json({ message: "Restaurant removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};