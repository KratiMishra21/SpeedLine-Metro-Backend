import Station from "../models/station.js";

export const getAllStations = async (req, res) => {
  try {
    const stations = await Station.find();
    res.status(200).json(stations);
  } catch (err) {
    res.status(500).json({ message: "Error fetching stations", error: err });
  }
};

export const getStationById = async (req, res) => {
  try {
    const station = await Station.findOne({ stationId: req.params.id });
    if (!station) return res.status(404).json({ message: "Station not found" });
    res.status(200).json(station);
  } catch (err) {
    res.status(500).json({ message: "Error fetching station", error: err });
  }
};
