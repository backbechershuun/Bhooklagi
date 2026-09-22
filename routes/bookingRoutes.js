import express from "express";
import {
  createBooking,
  getMyBookings,
  getRestaurantBookings,
  updateBookingStatus,
  startCheckout,
  verifyPayment,
} from "../controllers/bookingController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createBooking);
router.post("/checkout", protect, startCheckout);
router.post("/:id/verify", protect, verifyPayment);
router.get("/my", protect, getMyBookings);
router.get("/restaurant/:restaurantId", protect, getRestaurantBookings);
router.patch("/:id/status", protect, updateBookingStatus);

export default router;