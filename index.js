import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables FIRST
dotenv.config();

// Import routes
import routeRoutes from "./src/routes/routeRoutes.js";
import reportRoutes from "./src/routes/reportRoutes.js";
import liveMapRoutes from './src/routes/liveMapRoutes.js';  // Fixed path - added 'src/'

// Create Express app
const app = express();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://metro-frontend-beta.vercel.app',  // Removed trailing slash
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Serve static files from data folder
app.use("/data", express.static(path.join(__dirname, "data")));

// Debug middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.originalUrl}`);
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

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "🚇 Metro Intelligence Backend Running!",
    status: "active",
    version: "2.0",
    endpoints: {
      routes: "/api/routes",
      reports: "/api/reports",
      metroMap: "/api/metro-map"
    }
  });
});

// Register API routes
app.use("/api/routes", routeRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/metro-map", liveMapRoutes);

// 404 handler - must be AFTER all routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path,
    availableRoutes: ["/api/routes", "/api/reports", "/api/metro-map"]
  });
});

// Error handler - must be LAST
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Routes API: /api/routes`);
  console.log(`✅ Reports API: /api/reports`);
  console.log(`✅ Metro Map API: /api/metro-map`);
  console.log(`✅ Static files: /data`);
});

