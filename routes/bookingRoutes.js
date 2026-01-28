// routes/bookingRoutes.js
import express from "express";
import multer from "multer";
import {
  createBooking,
  getUserBookings,
  getAllBookings,
  updateBookingStatus,
  getOwnerBookings, // <-- add this import
} from "../controllers/bookingController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import Booking from "../models/Booking.js";

const router = express.Router();

// Multer setup
const storage = multer.diskStorage({});
const upload = multer({ storage });

// User routes
router.post("/", protect, upload.none(), createBooking);
router.get("/mybookings", protect, getUserBookings);

// Admin routes
// ✅ Admin routes
router.get("/", protect, adminOnly, getAllBookings);

// ✅ Allow both Admin and Owner to update booking status
router.put("/:id/status", protect, upload.none(), updateBookingStatus);

// Owner route: get bookings for turfs owned by logged-in owner
router.get("/owner", protect, getOwnerBookings); // ✅ Owner’s bookings
// Get booked slots for a turf on a date (existing)
router.get("/booked", async (req, res) => {
  try {
    const { date, turfId } = req.query;
    if (!date || !turfId) {
      return res.status(400).json({ message: "Missing date or turfId" });
    }

    const now = new Date();
    const [year, month, day] = date.split("-").map(Number);

    const bookings = await Booking.find({
      turf: turfId,
      date,
      status: { $ne: "Cancelled" },
    });

    const validBookings = bookings.filter((b) => {
      const [startTime] = b.timeSlot.split("-");
      const hour = parseTimeTo24Hour(startTime);

      const slotTime = new Date(year, month - 1, day, hour, 0, 0);
      return slotTime > now;
    });

    res.json(validBookings.map((b) => ({ timeSlot: b.timeSlot })));
  } catch (error) {
    res.status(500).json({ message: "Error fetching booked slots", error });
  }
});

export default router;
