import express from 'express';
import { getLiveMapData, getStationDetails, getNearbyStations } from '../controllers/liveMapController.js';

const router = express.Router();

router.get('/live-data', getLiveMapData);
router.get('/stations/:stationId/details', getStationDetails);
router.get('/nearby', getNearbyStations);

export default router;