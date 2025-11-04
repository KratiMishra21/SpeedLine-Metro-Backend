import express from "express";
import Station from "../models/station.js";
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const stations = await Station.find();
    res.json(stations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
