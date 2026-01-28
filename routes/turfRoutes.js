import express from "express";
import {
  getAllTurfs,
  addTurf,
  getTurfById,
  deleteTurf,
  getOwnerTurfs,
  updateTurf,
} from "../controllers/turfController.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// ✅ Public route
router.get("/", getAllTurfs);

// ✅ Owner's turfs route (must be before :id)
router.get("/my/own", protect, getOwnerTurfs);

// ✅ Add turf — admin or owner
router.post("/", protect, upload.array("images", 5), addTurf);

// ✅ Get single turf
router.get("/:id", getTurfById);

// ✅ Update turf — admin or owner
router.put("/:id", protect, upload.array("images", 5), updateTurf);

// ✅ Delete turf — admin or owner
router.delete("/:id", protect, deleteTurf);

export default router;
