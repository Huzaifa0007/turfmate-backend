import Turf from "../models/Turf.js";
import Booking from "../models/Booking.js";
import cloudinary from "../config/cloudinary.js";

// ✅ Get all turfs (public)
export const getAllTurfs = async (req, res) => {
  try {
    const { city, name } = req.query;
    let filter = {};

    if (city) filter.city = { $regex: city, $options: "i" };
    if (name) filter.name = { $regex: name, $options: "i" };

    const turfs = await Turf.find(filter).populate("owner", "name email");
    res.status(200).json(turfs);
  } catch (error) {
    res.status(500).json({ message: "Error fetching turfs", error });
  }
};

// ✅ Add a new turf (admin or owner)
export const addTurf = async (req, res) => {
  try {
    const {
      name,
      location,
      city,
      pricePerHour,
      amenities,
      availableSlots,
      ownerId,
    } = req.body;

    if (!name || !location || !city || !pricePerHour) {
      return res
        .status(400)
        .json({ message: "Please provide all required fields" });
    }

    // ✅ Role check
    if (req.user.role !== "admin" && req.user.role !== "owner") {
      return res.status(403).json({ message: "Not authorized to add turf" });
    }

    // ✅ Upload images to Cloudinary (BUFFER BASED)
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(
          `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
          {
            folder: "turfmate/turfs",
          },
        );
        imageUrls.push(result.secure_url);
      }
    }

    // ✅ Parse amenities
    const parsedAmenities =
      typeof amenities === "string"
        ? amenities.split(",").map((a) => a.trim())
        : Array.isArray(amenities)
          ? amenities
          : [];

    // ✅ Parse slots
    const parsedSlots = availableSlots
      ? availableSlots.split(/[;,]/).map((slot) => ({
          time: slot.trim(),
        }))
      : [];

    // ✅ Assign owner
    const owner =
      req.user.role === "owner" ? req.user._id : ownerId || undefined;

    const newTurf = new Turf({
      name,
      location,
      city,
      pricePerHour,
      amenities: parsedAmenities,
      availableSlots: parsedSlots,
      images: imageUrls,
      owner,
    });

    const savedTurf = await newTurf.save();

    res.status(201).json({
      message: "Turf added successfully",
      turf: savedTurf,
    });
  } catch (error) {
    console.error("Error adding turf:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// ✅ Get owner turfs
export const getOwnerTurfs = async (req, res) => {
  try {
    if (req.user.role !== "owner" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const turfs = await Turf.find({ owner: req.user._id }).populate(
      "owner",
      "name email",
    );

    res.status(200).json(turfs);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// ✅ Get single turf
export const getTurfById = async (req, res) => {
  try {
    const turf = await Turf.findById(req.params.id).populate(
      "owner",
      "name email",
    );
    if (!turf) return res.status(404).json({ message: "Turf not found" });
    res.json(turf);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateTurf = async (req, res) => {
  try {
    const turf = await Turf.findById(req.params.id);
    if (!turf) return res.status(404).json({ message: "Turf not found" });

    // role check
    if (
      req.user.role !== "admin" &&
      turf.owner?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const {
      name,
      location,
      city,
      pricePerHour,
      amenities,
      availableSlots,
      ownerId,
    } = req.body;

    // update basic fields
    turf.name = name || turf.name;
    turf.location = location || turf.location;
    turf.city = city || turf.city;
    turf.pricePerHour = pricePerHour || turf.pricePerHour;

    // amenities
    if (amenities) {
      turf.amenities = amenities.split(",").map((a) => a.trim());
    }

    // slots
    if (availableSlots) {
      turf.availableSlots = availableSlots.split(/[;,]/).map((s) => ({
        time: s.trim(),
      }));
    }

    // owner (admin only)
    if (req.user.role === "admin" && ownerId) {
      turf.owner = ownerId;
    }

    // 🔥 new images upload (append, don’t replace)
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(
          `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
          { folder: "turfmate/turfs" },
        );
        turf.images.push(result.secure_url);
      }
    }

    const updatedTurf = await turf.save();
    res.json({ message: "Turf updated successfully", turf: updatedTurf });
  } catch (error) {
    res.status(500).json({ message: "Update failed", error });
  }
};

// ✅ Delete turf + bookings
export const deleteTurf = async (req, res) => {
  try {
    const turf = await Turf.findById(req.params.id);
    if (!turf) return res.status(404).json({ message: "Turf not found" });

    if (
      req.user.role !== "admin" &&
      turf.owner?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await Booking.deleteMany({ turf: turf._id });
    await turf.deleteOne();

    res.json({ message: "Turf and related bookings deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
