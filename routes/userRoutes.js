import express from "express";
import {
  getUserProfile,
  updateUserProfile,
} from "../controllers/userController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

router
  .route("/profile")
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

// ✅ Get all owners (for assigning turf)
router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const owners = await User.find({ role: "owner" }).select("name email _id");
    res.json(owners);
  } catch (error) {
    res.status(500).json({ message: "Error fetching owners", error });
  }
});

export default router;
