// routes/reportRoutes.js
import express from "express";
import {
  submitReport,
  getReports,
  getReportsByStation,
  getCrowdSummary,
} from "../controllers/reportController.js";

const router = express.Router();

// Debug middleware
router.use((req, res, next) => {
  console.log(`📨 Reports API: ${req.method} ${req.path}`);
  next();
});

// ==================== POST Routes ====================
// Submit a new crowd report
router.post("/submit", submitReport);

// ==================== GET Routes ====================
// Get all recent reports
router.get("/all", getReports);

// Get reports for a specific station
router.get("/station/:station", getReportsByStation);

// Get crowd status summary for all stations
router.get("/summary", getCrowdSummary);

export default router;