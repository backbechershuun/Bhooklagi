import express from "express";
import { createReview, getMyReviews } from "../controllers/reviewController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createReview);
router.get("/mine", protect, getMyReviews);

export default router;