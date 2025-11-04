import express from "express";
import {
  getAllStations,
  getStationById,
  getAllStationsWithCrowd,
  getStationLiveDetails,
  getStationTrends,
  getStationReports,
  getNearbyStationsWithCrowd,
  getCrowdStatistics
} from "../controllers/stationController.js";

const router = express.Router();

// EXISTING ROUTES
router.get("/", getAllStations);
router.get("/:id", getStationById);

// NEW ROUTES FOR LIVE MAP FEATURE

// Get all stations with live crowd data
router.get("/live/all", getAllStationsWithCrowd);

// Get overall crowd statistics
router.get("/live/stats", getCrowdStatistics);

// Get nearby stations with crowd info
router.get("/live/nearby", getNearbyStationsWithCrowd);

// Get specific station live details
router.get("/:id/live", getStationLiveDetails);

// Get hourly trends for a station
router.get("/:id/trends", getStationTrends);

// Get all reports for a station
router.get("/:id/reports", getStationReports);

export default router;
