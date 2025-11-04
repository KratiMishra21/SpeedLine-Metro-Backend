import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import { createServer } from "http";
import { initializeSocket } from "./utils/socket.js";

// Import routes
import stationRoutes from "./routes/stationRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import routeRoutes from "./routes/routeRoutes.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
initializeSocket(httpServer);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Routes
app.use("/api/stations", stationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/routes", routeRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({ 
    message: "Delhi Metro Smart Crowd Navigator API", 
    version: "2.0",
    features: ["Route Optimizer", "Community Reports", "Live Map"],
    status: "active"
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false,
    message: "Something went wrong!", 
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: "Route not found" 
  });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO enabled for real-time updates`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
});

