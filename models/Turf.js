import mongoose from "mongoose";

const slotSchema = new mongoose.Schema({
  time: { type: String, required: true }, // e.g. "9AM-10AM"
});

const turfSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  city: { type: String, required: true },
  pricePerHour: { type: Number, required: true },
  amenities: [String],
  availableSlots: [slotSchema],
  images: [String],
  ratings: { type: Number, default: 4.5 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // ✅ Linked to owner
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Turf", turfSchema);
