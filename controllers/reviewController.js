import mongoose from "mongoose";
import Review from "../models/Review.js";
import Booking from "../models/Booking.js";
import updateRestaurantRating from "../utils/updateRestaurantRating.js";

// @route POST /api/reviews  (booking-based)
export const createReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    const userId = req.user._id;

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not your booking" });
    }

    const existing = await Review.findOne({ booking: bookingId });
    if (existing) {
      return res.status(400).json({ message: "You already reviewed this booking" });
    }

    const review = await Review.create({
      restaurant: booking.restaurant,
      booking: bookingId,
      user: userId,
      rating,
      comment,
    });

    await updateRestaurantRating(new mongoose.Types.ObjectId(booking.restaurant));

    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/reviews/mine
export const getMyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.user._id });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/restaurants/:restaurantId/reviews
export const getReviews = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const reviews = await Review.find({ restaurant: restaurantId })
      .populate("user", "name")
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route PUT /api/reviews/:id
export const updateReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    review.rating = req.body.rating ?? review.rating;
    review.comment = req.body.comment ?? review.comment;
    await review.save();
    await updateRestaurantRating(review.restaurant);
    res.json(review);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route DELETE /api/reviews/:id
export const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const restaurantId = review.restaurant;
    await review.deleteOne();
    await updateRestaurantRating(restaurantId);
    res.json({ message: "Review removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};