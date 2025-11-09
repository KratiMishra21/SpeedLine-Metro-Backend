import express from 'express';
import {
  getLiveMapData,
  getStationDetails,
  getNearbyStations
} from '../controllers/liveMapController.js';

const router = express.Router();

// GET /api/metro-map/live-data - Get all stations with crowd data
router.get('/live-data', getLiveMapData);

// GET /api/metro-map/stations/:stationId/details - Get station details
router.get('/stations/:stationId/details', getStationDetails);

// GET /api/metro-map/nearby - Get nearby stations
router.get('/nearby', getNearbyStations);

export default router;