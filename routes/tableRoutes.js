import express from "express";
import {
  addTable,
  getTablesByRestaurant,
  getAvailableTables,
  updateTablePosition,
  deleteTable,
} from "../controllers/tableController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:restaurantId", getTablesByRestaurant);
router.get("/:restaurantId/availability", getAvailableTables);
router.post("/:restaurantId", protect, authorize("owner", "admin"), addTable);
router.patch("/:id/position", protect, authorize("owner", "admin"), updateTablePosition);
router.delete("/:id", protect, authorize("owner", "admin"), deleteTable);

export default router;