import express from "express";
import {
  createRestaurant,
  getRestaurants,
  getRestaurantById,
  updateRestaurant,
  deleteRestaurant,
  getMyRestaurants,
} from "../controllers/restaurantController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.middleware.js";
import reviewRoutes from "./reviewRoutes.js";

const router = express.Router();

// Nested review routes: /api/restaurants/:restaurantId/reviews
router.use("/:restaurantId/reviews", reviewRoutes);

// IMPORTANT: /mine must come before /:id, or Express treats "mine" as an :id value
router.get("/mine", protect, authorize("owner"), getMyRestaurants);

router.get("/", getRestaurants);
router.get("/:id", getRestaurantById);

router.post(
  "/",
  protect,
  authorize("owner", "admin"),
  upload.fields([{ name: "image", maxCount: 1 }]),
  createRestaurant
);

router.put(
  "/:id",
  protect,
  authorize("owner", "admin"),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "interiorImage", maxCount: 1 },
  ]),
  updateRestaurant
);

router.delete("/:id", protect, authorize("owner", "admin"), deleteRestaurant);

export default router;