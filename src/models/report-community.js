import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  station: String,
  level: String,
  remarks: String,
  userId: String,
  photo: String,
  likes: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
}, { timestamps: true });

const Report = mongoose.model("Report", reportSchema);
export default Report;