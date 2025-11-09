import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import routeRoutes from "./src/routes/routeRoutes.js";
import reportRoutes from "./src/routes/reportRoutes.js";
import liveMapRoutes from './routes/liveMapRoutes.js';
app.use('/api/metro-map', liveMapRoutes);
dotenv.config();
const app = express();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// UPDATED CORS Configuration - Allow your deployed frontend
const allowedOrigins = [
  'http://localhost:3000',           // Local development
  'https://metro-frontend-beta.vercel.app/',  // Replace with your actual Vercel URL
  // Add more frontend URLs if needed
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


