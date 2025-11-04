import express from "express";
import { getShortestRoute } from "../controllers/routeController.js";

const router = express.Router();

// Define POST endpoint for /api/routes/shortest
router.post("/shortest", getShortestRoute);

export default router;


