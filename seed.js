// backend/seed.js
import mongoose from "mongoose";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import Station from "./src/models/station.js";
import Edge from "./src/models/edge.js";

dotenv.config();

const __dirname = path.resolve();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/metroDB";

const seedData = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    // Clear old data
    await Station.deleteMany({});
    await Edge.deleteMany({});
    console.log("🧹 Old data cleared");

    // Load JSON files
    const stationsData = JSON.parse(
      fs.readFileSync(path.join(__dirname, "data/stations.json"), "utf-8")
    );
    const edgesData = JSON.parse(
      fs.readFileSync(path.join(__dirname, "data/edges.json"), "utf-8")
    );

    // Insert new data
    await Station.insertMany(stationsData);
    await Edge.insertMany(edgesData);
    console.log(`🌱 Seeded ${stationsData.length} stations and ${edgesData.length} edges`);

    mongoose.connection.close();
    console.log("✅ Database seeding complete & connection closed");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    mongoose.connection.close();
  }
};

seedData();
