import mongoose from "mongoose";

const edgeSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  travelTime: { type: Number, required: true },
});

const Edge = mongoose.model("Edge", edgeSchema);
export default Edge;
