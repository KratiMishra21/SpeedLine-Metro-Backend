import mongoose from "mongoose";
const { Schema } = mongoose;

const UserSchema = new Schema({
  name: String,
  email: { type: String, unique: true, index: true },
  passwordHash: String,
  reputation: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  badges: [String],
});

export default mongoose.model("User", UserSchema);
