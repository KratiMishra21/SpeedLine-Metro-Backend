import Station from '../models/station.js';
import Report from '../models/report-community.js';

export const getLiveMapData = async (req, res) => {
  try {
    console.log('Fetching live map data...');
    
    // Get all stations
    const stations = await Station.find({});
    console.log(`Found ${stations.length} stations`);
    
    if (!stations || stations.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          stations: [],
          totalStations: 0,
          timestamp: new Date()
        },
        message: 'No stations found in database'
      });
    }
    
    // Get recent reports for all stations (last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentReports = await Report.find({
      createdAt: { $gte: twoHoursAgo }
    });
    
    console.log(`Found ${recentReports.length} recent reports`);

    // Group reports by station
    const stationReportsMap = {};
    
    recentReports.forEach(report => {
      const stationId = report.station; // This is the stationId string (e.g., "rajiv-chowk")
      if (!stationReportsMap[stationId]) {
        stationReportsMap[stationId] = [];
      }
      stationReportsMap[stationId].push(report);
    });

    // Calculate crowd level for each station
    const liveStationData = stations.map(station => {
      const stationReports = stationReportsMap[station.stationId] || [];
      
      let crowdLevel = 'low'; // default when no reports
      let reportCount = stationReports.length;
      
      if (stationReports.length > 0) {
        // Calculate weighted average based on time and likes
        const now = Date.now();
        let totalWeight = 0;
        const scores = { low: 0, moderate: 0, high: 0 };
        
        stationReports.forEach(report => {
          // Time decay: newer reports have more weight
          const ageMinutes = (now - new Date(report.createdAt).getTime()) / (1000 * 60);
          const timeWeight = Math.exp(-ageMinutes / 60); // Exponential decay over 60 mins
          
          // Credibility: reports with more likes are more trustworthy
          const credibilityWeight = 1 + Math.log(report.likes + 1) * 0.3;
          
          const weight = timeWeight * credibilityWeight;
          
          // Map 'moderate' to 'medium' if needed
          const level = report.level === 'moderate' ? 'moderate' : report.level;
          
          if (level === 'low') scores.low += weight;
          else if (level === 'moderate') scores.moderate += weight;
          else if (level === 'high') scores.high += weight;
          
          totalWeight += weight;
        });
        
        // Determine dominant level
        if (totalWeight > 0) {
          const normalizedScores = {
            low: scores.low / totalWeight,
            moderate: scores.moderate / totalWeight,
            high: scores.high / totalWeight
          };
          
          // Find the highest score
          if (normalizedScores.high > normalizedScores.moderate && normalizedScores.high > normalizedScores.low) {
            crowdLevel = 'high';
          } else if (normalizedScores.moderate > normalizedScores.low) {
            crowdLevel = 'medium';
          } else {
            crowdLevel = 'low';
          }
        }
      }

      // Get last updated time
      let lastUpdated = null;
      if (stationReports.length > 0) {
        const sortedReports = stationReports.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        lastUpdated = sortedReports[0].createdAt;
      }

      return {
        _id: station._id,
        stationId: station.stationId,
        name: station.name,
        coordinates: station.coords.coordinates, // [lng, lat] - GeoJSON format
        lines: station.lines || [],
        isInterchange: station.lines && station.lines.length > 1,
        crowdLevel,
        reportCount,
        lastUpdated
      };
    });

    console.log('Live station data prepared successfully');

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
    console.log('Fetching details for station:', stationId);
    
    // Find station by MongoDB _id or stationId slug
    let station;
    if (stationId.match(/^[0-9a-fA-F]{24}$/)) {
      // MongoDB ObjectId
      station = await Station.findById(stationId);
    } else {
      // Station slug (e.g., "rajiv-chowk")
      station = await Station.findOne({ stationId: stationId });
    }
    
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Station not found'
      });
    }

    // Get recent reports (last 1 hour) using stationId
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentReports = await Report.find({
      station: station.stationId, // Use stationId string, not _id
      createdAt: { $gte: oneHourAgo }
    }).sort({ createdAt: -1 }).limit(10);

    console.log(`Found ${recentReports.length} reports for station ${station.name}`);

    // Calculate current crowd level
    let currentCrowdLevel = 'low';
    
    if (recentReports.length > 0) {
      const now = Date.now();
      let totalWeight = 0;
      const scores = { low: 0, moderate: 0, high: 0 };
      
      // Use only the 5 most recent reports for current level
      const last5Reports = recentReports.slice(0, 5);
      
      last5Reports.forEach(report => {
        const ageMinutes = (now - new Date(report.createdAt).getTime()) / (1000 * 60);
        const timeWeight = Math.exp(-ageMinutes / 30); // Faster decay for current level
        const credibilityWeight = 1 + Math.log(report.likes + 1) * 0.3;
        const weight = timeWeight * credibilityWeight;
        
        const level = report.level === 'moderate' ? 'moderate' : report.level;
        
        if (level === 'low') scores.low += weight;
        else if (level === 'moderate') scores.moderate += weight;
        else if (level === 'high') scores.high += weight;
        
        totalWeight += weight;
      });
      
      if (totalWeight > 0) {
        const normalizedScores = {
          low: scores.low / totalWeight,
          moderate: scores.moderate / totalWeight,
          high: scores.high / totalWeight
        };
        
        if (normalizedScores.high > normalizedScores.moderate && normalizedScores.high > normalizedScores.low) {
          currentCrowdLevel = 'high';
        } else if (normalizedScores.moderate > normalizedScores.low) {
          currentCrowdLevel = 'medium';
        } else {
          currentCrowdLevel = 'low';
        }
      }
    }

    res.json({
      success: true,
      data: {
        station: {
          _id: station._id,
          stationId: station.stationId,
          name: station.name,
          coordinates: station.coords.coordinates,
          lines: station.lines || [],
          isInterchange: station.lines && station.lines.length > 1
        },
        currentCrowdLevel,
        recentReports: recentReports.map(r => ({
          _id: r._id,
          crowdLevel: r.level,
          remarks: r.remarks,
          likes: r.likes,
          createdAt: r.createdAt,
          userId: r.userId
        })),
        totalReportsLastHour: recentReports.length
      }
    });
  } catch (error) {
    console.error('Station details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch station details',
      error: error.message
    });
  }
};

// Get nearby stations based on coordinates
export const getNearbyStations = async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 5000 } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: 'Longitude and latitude are required'
      });
    }

    const lng = parseFloat(longitude);
    const lat = parseFloat(latitude);
    const distance = parseInt(maxDistance);

    if (isNaN(lng) || isNaN(lat)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
    }

    const stations = await Station.find({
      coords: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          $maxDistance: distance
        }
      }
    }).limit(10);

    // Get crowd data for nearby stations
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const stationIds = stations.map(s => s.stationId);
    const recentReports = await Report.find({
      station: { $in: stationIds },
      createdAt: { $gte: twoHoursAgo }
    });

    // Group reports by station
    const stationReportsMap = {};
    recentReports.forEach(report => {
      if (!stationReportsMap[report.station]) {
        stationReportsMap[report.station] = [];
      }
      stationReportsMap[report.station].push(report);
    });

    // Add crowd info to stations
    const stationsWithCrowd = stations.map(station => {
      const reports = stationReportsMap[station.stationId] || [];
      
      let crowdLevel = 'low';
      if (reports.length > 0) {
        const now = Date.now();
        let totalWeight = 0;
        const scores = { low: 0, moderate: 0, high: 0 };
        
        reports.forEach(report => {
          const ageMinutes = (now - new Date(report.createdAt).getTime()) / (1000 * 60);
          const timeWeight = Math.exp(-ageMinutes / 60);
          const credibilityWeight = 1 + Math.log(report.likes + 1) * 0.3;
          const weight = timeWeight * credibilityWeight;
          
          const level = report.level === 'moderate' ? 'moderate' : report.level;
          if (level === 'low') scores.low += weight;
          else if (level === 'moderate') scores.moderate += weight;
          else if (level === 'high') scores.high += weight;
          
          totalWeight += weight;
        });
        
        if (totalWeight > 0) {
          const normalizedScores = {
            low: scores.low / totalWeight,
            moderate: scores.moderate / totalWeight,
            high: scores.high / totalWeight
          };
          
          if (normalizedScores.high > normalizedScores.moderate && normalizedScores.high > normalizedScores.low) {
            crowdLevel = 'high';
          } else if (normalizedScores.moderate > normalizedScores.low) {
            crowdLevel = 'medium';
          }
        }
      }

      return {
        _id: station._id,
        stationId: station.stationId,
        name: station.name,
        coordinates: station.coords.coordinates,
        lines: station.lines || [],
        isInterchange: station.lines && station.lines.length > 1,
        crowdLevel,
        reportCount: reports.length
      };
    });

    res.json({
      success: true,
      data: {
        stations: stationsWithCrowd,
        count: stationsWithCrowd.length,
        searchCenter: { longitude: lng, latitude: lat },
        searchRadius: distance
      }
    });
  } catch (error) {
    console.error('Nearby stations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nearby stations',
      error: error.message
    });
  }
};