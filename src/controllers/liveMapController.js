import Station from '../models/station.js';
import Report from '../models/report-community.js';

export const getLiveMapData = async (req, res) => {
  try {
    // Get all stations
    const stations = await Station.find({});
    
    // Get recent reports for all stations (last 30 minutes)
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const recentReports = await Report.find({
      createdAt: { $gte: thirtyMinsAgo }
    }).populate('station', 'name stationId');

    // Calculate crowd level for each station
    const stationCrowdMap = {};
    
    recentReports.forEach(report => {
      const stationId = report.station._id.toString();
      if (!stationCrowdMap[stationId]) {
        stationCrowdMap[stationId] = {
          reports: [],
          station: report.station
        };
      }
      stationCrowdMap[stationId].reports.push(report);
    });

    // Calculate average crowd level
    const liveStationData = stations.map(station => {
      const stationId = station._id.toString();
      const stationReports = stationCrowdMap[stationId];
      
      let crowdLevel = 'low'; // default
      let reportCount = 0;
      
      if (stationReports && stationReports.reports.length > 0) {
        const crowdValues = { low: 1, medium: 2, high: 3 };
        const avgCrowd = stationReports.reports.reduce((sum, report) => {
          return sum + crowdValues[report.crowdLevel];
        }, 0) / stationReports.reports.length;
        
        reportCount = stationReports.reports.length;
        
        if (avgCrowd <= 1.5) crowdLevel = 'low';
        else if (avgCrowd <= 2.5) crowdLevel = 'medium';
        else crowdLevel = 'high';
      }

      return {
        _id: station._id,
        stationId: station.stationId,
        name: station.name,
        coordinates: station.coords.coordinates, // [lng, lat] - GeoJSON format
        lines: station.lines,
        isInterchange: station.lines && station.lines.length > 1,
        crowdLevel,
        reportCount,
        lastUpdated: stationReports?.reports[0]?.createdAt || null
      };
    });

    res.json({
      success: true,
      data: {
        stations: liveStationData,
        totalStations: liveStationData.length,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Live map data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch live map data',
      error: error.message
    });
  }
};

export const getStationDetails = async (req, res) => {
  try {
    const { stationId } = req.params;
    
    const station = await Station.findById(stationId);
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Station not found'
      });
    }

    // Get recent reports (last 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentReports = await Report.find({
      station: stationId,
      createdAt: { $gte: oneHourAgo }
    }).sort({ createdAt: -1 }).limit(10);

    // Calculate current crowd level
    const crowdMap = { low: 1, medium: 2, high: 3 };
    let currentCrowdLevel = 'low';
    
    if (recentReports.length > 0) {
      const last5Reports = recentReports.slice(0, 5);
      const avgCrowd = last5Reports.reduce((sum, report) => {
        return sum + crowdMap[report.crowdLevel];
      }, 0) / last5Reports.length;
      
      if (avgCrowd <= 1.5) currentCrowdLevel = 'low';
      else if (avgCrowd <= 2.5) currentCrowdLevel = 'medium';
      else currentCrowdLevel = 'high';
    }

    res.json({
      success: true,
      data: {
        station,
        currentCrowdLevel,
        recentReports: recentReports.slice(0, 5),
        totalReportsLastHour: recentReports.length
      }
    });
  } catch (error) {
    console.error('Station details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch station details'
    });
  }
};

// Get nearby stations based on coordinates
export const getNearbyStations = async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 5000 } = req.query; // maxDistance in meters

    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: 'Longitude and latitude are required'
      });
    }

    const stations = await Station.find({
      coords: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      }
    }).limit(10);

    res.json({
      success: true,
      data: {
        stations,
        count: stations.length
      }
    });
  } catch (error) {
    console.error('Nearby stations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nearby stations'
    });
  }
};