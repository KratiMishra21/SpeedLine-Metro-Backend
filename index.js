import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import routeRoutes from "./src/routes/routeRoutes.js";
import reportRoutes from "./src/routes/reportRoutes.js";

dotenv.config();
const app = express();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ limit: "50mb" }));

// Serve static files from data folder
app.use("/data", express.static(path.join(__dirname, "data")));

// Debug middleware
app.use((req, res, next) => {
  console.log(`📨 Incoming request: ${req.method} ${req.originalUrl}`);
  next();
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    process.exit(1);
  }
};

connectDB();

// Register routes
app.use("/api/routes", routeRoutes);
app.use("/api/reports", reportRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.send("🚇 Metro Intelligence Backend Running!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Route registered: POST /api/routes/shortest`);
  console.log(`✅ Reports API registered: /api/reports`);
  console.log(`✅ Static files served from /data`);
});


