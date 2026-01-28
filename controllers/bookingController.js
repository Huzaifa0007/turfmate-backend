// controllers/bookingController.js
import Booking from "../models/Booking.js";
import Turf from "../models/Turf.js";

const parseTimeTo24Hour = (timeStr) => {
  const clean = timeStr.trim().toLowerCase();
  const isPM = clean.includes("pm");

  const numberPart = clean.replace(/am|pm/g, "").trim();
  let hour = parseInt(numberPart, 10);

  if (isNaN(hour)) return null;

  if (isPM && hour !== 12) hour += 12;
  if (!isPM && hour === 12) hour = 0;

  return hour;
};

// ✅ Create a new booking
export const createBooking = async (req, res) => {
  try {
    const { turfId, date, timeSlot } = req.body;

    // =========================
    // ❗ Basic Validation
    // =========================
    if (!turfId || !date || !timeSlot) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const turf = await Turf.findById(turfId);
    if (!turf) {
      return res.status(404).json({ message: "Turf not found" });
    }

    // =========================
    // ⛔ Past Date Check (UTC)
    // =========================
    const now = new Date(); // current UTC time

    const [year, month, day] = date.split("-").map(Number);

    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);

    const selectedDateUTC = new Date(Date.UTC(year, month - 1, day));

    if (selectedDateUTC < todayUTC) {
      return res.status(400).json({
        message: "Cannot book a past date",
      });
    }

    // =========================
    // ⛔ Past Time Slot Check (LOCAL TIME)
    // =========================

    // extract start time from "9 AM - 10 AM" or "09:00-10:00"
    const [startTime] = timeSlot.split("-");
    const time = startTime.trim().toLowerCase();

    // convert to 24-hour
    let hour;
    if (time.includes("am") || time.includes("pm")) {
      const num = parseInt(time);
      hour =
        time.includes("pm") && num !== 12
          ? num + 12
          : num === 12 && time.includes("am")
            ? 0
            : num;
    } else {
      hour = parseInt(time.split(":")[0]);
    }

    const slotDateTime = new Date(year, month - 1, day, hour, 0, 0);

    if (slotDateTime <= now) {
      return res.status(400).json({
        message: "Cannot book a past time slot",
      });
    }

    // // =========================
    // // ⛔ Past Time Slot Check (LOCAL TIME - CORRECT)
    // // =========================

    // const [startTime] = timeSlot.split("-");

    // const hour = parseTimeTo24Hour(startTime);

    // if (hour === null) {
    //   return res.status(400).json({ message: "Invalid time slot format" });
    // }

    // const slotDateTime = new Date(year, month - 1, day, hour, 0, 0);

    // if (slotDateTime <= now) {
    //   return res.status(400).json({
    //     message: "Cannot book a past time slot",
    //   });
    // }

    // =========================
    // ❌ Already Booked Check
    // =========================
    const existingBooking = await Booking.findOne({
      turf: turfId,
      date,
      timeSlot,
      status: { $ne: "Cancelled" },
    });

    if (existingBooking) {
      return res.status(400).json({
        message: "This time slot is already booked",
      });
    }

    // =========================
    // ✅ Create Booking
    // =========================
    const newBooking = new Booking({
      user: req.user._id,
      turf: turfId,
      date,
      timeSlot,
      status: "Pending",
    });

    await newBooking.save();

    return res.status(201).json({
      message: "Booking created successfully",
      booking: newBooking,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get bookings for logged-in user
export const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate("turf", "name city pricePerHour images")
      .sort({ createdAt: -1 });

    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user bookings", error });
  }
};

// ✅ Admin: Get all bookings
export const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("user", "name email")
      .populate("turf", "name city pricePerHour")
      .sort({ createdAt: -1 });

    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: "Error fetching all bookings", error });
  }
};

// ✅ Update booking status (Admin or Owner)
// ✅ Update booking status (Admin or Owner)
// ✅ Update booking status (Admin or Owner)
// ✅ Update booking status (Admin or Owner)
export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    // Deep populate turf -> owner
    const booking = await Booking.findById(id)
      .populate({
        path: "turf",
        populate: { path: "owner", select: "name email _id" },
      })
      .populate("user", "name email");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // ✅ Verify owner
    const turfOwnerId = booking.turf?.owner?._id?.toString();
    const currentUserId = req.user._id.toString();

    const isOwner = turfOwnerId === currentUserId;

    // ✅ Check permissions
    if (req.user.role !== "admin" && !isOwner) {
      console.warn("Unauthorized update attempt by:", req.user._id);
      return res
        .status(403)
        .json({ message: "Not authorized to update this booking" });
    }

    booking.status = status;
    await booking.save();

    res.status(200).json({
      message: `Booking ${status} successfully by ${
        req.user.role === "admin" ? "Admin" : "Owner"
      }`,
      booking,
    });
  } catch (error) {
    console.error("Error updating booking status:", error);
    res.status(500).json({ message: "Error updating booking status", error });
  }
};

// ✅ Get bookings for owner’s turfs
export const getOwnerBookings = async (req, res) => {
  try {
    if (req.user.role !== "owner" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    // ✅ Find all turfs owned by the logged-in owner
    const ownerTurfs = await Turf.find({ owner: req.user._id }).select("_id");

    // ✅ Get all bookings related to those turfs
    const bookings = await Booking.find({ turf: { $in: ownerTurfs } })
      .populate("user", "name email")
      .populate("turf", "name city")
      .sort({ createdAt: -1 });

    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching owner bookings:", error);
    res.status(500).json({ message: "Server error", error });
  }
};
