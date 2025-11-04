import mongoose from "mongoose";
const { Schema } = mongoose;

const StationSchema = new Schema({
  stationId: String, // slug (e.g. rajiv-chowk)
  name: String,
  coords: { type: { type: String, default: "Point" }, coordinates: [Number] },
  lines: [String],
  meta: { entryCount: Number },
});

StationSchema.index({ coords: "2dsphere" });
export default mongoose.model("Station", StationSchema);
