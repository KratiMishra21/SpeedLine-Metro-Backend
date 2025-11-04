import mongoose from "mongoose";
import Station from "./models/Station.js";
import fs from "fs";

const MONGO_URI = process.env.MONGO_URI;
edges.push({
  from: edge.to,
  to: edge.from,
  distance: edge.distance,
  line: edge.line
});
async function seedStations() {
  await mongoose.connect(MONGO_URI);
  const data = JSON.parse(fs.readFileSync("./data/stations.json", "utf-8"));
  await Station.deleteMany({});
  await Station.insertMany(data);
  console.log("✅ Stations seeded successfully");
  mongoose.disconnect();
}

seedStations();
