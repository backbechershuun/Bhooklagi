import express from "express";
import {
  createReview,
  getReviews,
  updateReview,
  deleteReview,
} from "../controllers/reviewController.js";
import { protect } from "../middleware/authMiddleware.js"; // adjust path/name to match yours

const router = express.Router({ mergeParams: true });

router.route("/").post(protect, createReview).get(getReviews);
router.route("/:id").put(protect, updateReview).delete(protect, deleteReview);

export default router;