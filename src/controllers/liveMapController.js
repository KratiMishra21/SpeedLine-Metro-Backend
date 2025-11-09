import Station from '../models/station.js';
import Report from '../models/report-community.js';

/**
 * Normalize crowd level to standard format
 * Handles: light/low, moderate/medium, heavy/high
 */
function normalizeCrowdLevel(level) {
  if (!level) return 'low';
  
  const normalized = level.toLowerCase().trim();
  
  // Map various formats to standard: low, moderate, high
  if (normalized === 'light' || normalized === 'low') return 'low';
  if (normalized === 'moderate' || normalized === 'medium') return 'moderate';
  if (normalized === 'heavy' || normalized === 'high') return 'high';
  
  return 'low'; // default
}

/**
 * Map normalized level to frontend expected format
 */
function mapToFrontendLevel(level) {
  if (level === 'low') return 'low';
  if (level === 'moderate') return 'medium'; // Frontend expects 'medium'
  if (level === 'high') return 'high';
  return 'low';
}

export const getLiveMapData = async (req, res) => {
  try {
    console.log('🚀 Fetching live map data...');
    
    // Get all stations
    const stations = await Station.find({});
    console.log(`📍 Found ${stations.length} stations`);
    
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
    
    // Get recent reports (last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentReports = await Report.find({
      createdAt: { $gte: twoHoursAgo }
    }).sort({ createdAt: -1 });
    
    console.log(`📊 Found ${recentReports.length} recent reports`);
    
    // Debug: Log first few reports to see what data we have
    if (recentReports.length > 0) {
      console.log('Sample report:', {
        station: recentReports[0].station,
        level: recentReports[0].level,
        crowdLevel: recentReports[0].crowdLevel,
        createdAt: recentReports[0].createdAt
      });
    }

    // Group reports by station
    const stationReportsMap = {};
    
    recentReports.forEach(report => {
      const stationId = report.station; // stationId string like "rajiv-chowk"
      
      if (!stationReportsMap[stationId]) {
        stationReportsMap[stationId] = [];
      }
      stationReportsMap[stationId].push(report);
    });

    console.log(`🗺️ Reports grouped for ${Object.keys(stationReportsMap).length} stations`);

    // Calculate crowd level for each station
    const liveStationData = stations.map(station => {
      const stationReports = stationReportsMap[station.stationId] || [];
      
      let crowdLevel = 'low'; // default
      let reportCount = stationReports.length;
      
      if (stationReports.length > 0) {
        console.log(`\n🔍 Processing ${station.name}:`);
        console.log(`   Reports: ${stationReports.length}`);
        
        // Calculate weighted average based on time and likes
        const now = Date.now();
        let totalWeight = 0;
        const scores = { low: 0, moderate: 0, high: 0 };
        
        stationReports.forEach(report => {
          // Get crowd level from either 'level' or 'crowdLevel' field
          const rawLevel = report.crowdLevel || report.level;
          const normalizedLevel = normalizeCrowdLevel(rawLevel);
          
          console.log(`   - Report: ${rawLevel} → ${normalizedLevel}, ${report.likes} likes`);
          
          // Time decay: newer reports have more weight
          const ageMinutes = (now - new Date(report.createdAt).getTime()) / (1000 * 60);
          const timeWeight = Math.exp(-ageMinutes / 60); // Exponential decay over 60 mins
          
          // Credibility: reports with more likes are more trustworthy
          const credibilityWeight = 1 + Math.log(report.likes + 1) * 0.3;
          
          const weight = timeWeight * credibilityWeight;
          
          scores[normalizedLevel] += weight;
          totalWeight += weight;
        });
        
        // Determine dominant level
        if (totalWeight > 0) {
          const normalizedScores = {
            low: scores.low / totalWeight,
            moderate: scores.moderate / totalWeight,
            high: scores.high / totalWeight
          };
          
          console.log(`   Scores:`, normalizedScores);
          
          // Find the highest score
          if (normalizedScores.high > normalizedScores.moderate && normalizedScores.high > normalizedScores.low) {
            crowdLevel = 'high';
          } else if (normalizedScores.moderate > normalizedScores.low) {
            crowdLevel = 'moderate';
          } else {
            crowdLevel = 'low';
          }
          
          console.log(`   Final level: ${crowdLevel}`);
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
        coordinates: station.coords.coordinates,
        lines: station.lines || [],
        isInterchange: station.lines && station.lines.length > 1,
        crowdLevel: mapToFrontendLevel(crowdLevel), // Map to frontend format
        reportCount,
        lastUpdated
      };
    });

    // Log summary
    const crowdStats = {
      low: liveStationData.filter(s => s.crowdLevel === 'low').length,
      medium: liveStationData.filter(s => s.crowdLevel === 'medium').length,
      high: liveStationData.filter(s => s.crowdLevel === 'high').length,
    };
    console.log('\n📊 Final crowd distribution:', crowdStats);

    res.json({
      success: true,
      data: {
        stations: liveStationData,
        totalStations: liveStationData.length,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('❌ Live map data error:', error);
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
    console.log('🔍 Fetching details for station:', stationId);
    
    // Find station by MongoDB _id or stationId slug
    let station;
    if (stationId.match(/^[0-9a-fA-F]{24}$/)) {
      station = await Station.findById(stationId);
    } else {
      station = await Station.findOne({ stationId: stationId });
    }
    
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Station not found'
      });
    }

    // Get recent reports (last 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentReports = await Report.find({
      station: station.stationId,
      createdAt: { $gte: oneHourAgo }
    }).sort({ createdAt: -1 }).limit(10);

    console.log(`📊 Found ${recentReports.length} reports for ${station.name}`);

    // Calculate current crowd level
    let currentCrowdLevel = 'low';
    
    if (recentReports.length > 0) {
      const now = Date.now();
      let totalWeight = 0;
      const scores = { low: 0, moderate: 0, high: 0 };
      
      const last5Reports = recentReports.slice(0, 5);
      
      last5Reports.forEach(report => {
        const rawLevel = report.crowdLevel || report.level;
        const normalizedLevel = normalizeCrowdLevel(rawLevel);
        
        const ageMinutes = (now - new Date(report.createdAt).getTime()) / (1000 * 60);
        const timeWeight = Math.exp(-ageMinutes / 30);
        const credibilityWeight = 1 + Math.log(report.likes + 1) * 0.3;
        const weight = timeWeight * credibilityWeight;
        
        scores[normalizedLevel] += weight;
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
          currentCrowdLevel = 'moderate';
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
        currentCrowdLevel: mapToFrontendLevel(currentCrowdLevel),
        recentReports: recentReports.map(r => ({
          _id: r._id,
          crowdLevel: normalizeCrowdLevel(r.crowdLevel || r.level),
          remarks: r.remarks,
          likes: r.likes,
          createdAt: r.createdAt,
          userId: r.userId
        })),
        totalReportsLastHour: recentReports.length
      }
    });
  } catch (error) {
    console.error('❌ Station details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch station details',
      error: error.message
    });
  }
};

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

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const stationIds = stations.map(s => s.stationId);
    const recentReports = await Report.find({
      station: { $in: stationIds },
      createdAt: { $gte: twoHoursAgo }
    });

    const stationReportsMap = {};
    recentReports.forEach(report => {
      if (!stationReportsMap[report.station]) {
        stationReportsMap[report.station] = [];
      }
      stationReportsMap[report.station].push(report);
    });

    const stationsWithCrowd = stations.map(station => {
      const reports = stationReportsMap[station.stationId] || [];
      
      let crowdLevel = 'low';
      if (reports.length > 0) {
        const now = Date.now();
        let totalWeight = 0;
        const scores = { low: 0, moderate: 0, high: 0 };
        
        reports.forEach(report => {
          const rawLevel = report.crowdLevel || report.level;
          const normalizedLevel = normalizeCrowdLevel(rawLevel);
          
          const ageMinutes = (now - new Date(report.createdAt).getTime()) / (1000 * 60);
          const timeWeight = Math.exp(-ageMinutes / 60);
          const credibilityWeight = 1 + Math.log(report.likes + 1) * 0.3;
          const weight = timeWeight * credibilityWeight;
          
          scores[normalizedLevel] += weight;
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
            crowdLevel = 'moderate';
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
        crowdLevel: mapToFrontendLevel(crowdLevel),
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
    console.error('❌ Nearby stations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nearby stations',
      error: error.message
    });
  }
};