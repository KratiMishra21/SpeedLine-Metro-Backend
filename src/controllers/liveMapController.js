// backend/src/controllers/liveMapController.js

import Station from '../models/station.js';
import Report from '../models/report-community.js';

export const getLiveMapData = async (req, res) => {
  try {
    console.log('🚀 Fetching live map data...');
    
    // Get all stations
    const stations = await Station.find({});
    console.log(`📍 Found ${stations.length} stations`);
    
    // Get recent reports for all stations (last 2 hours for better coverage)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentReports = await Report.find({
      createdAt: { $gte: twoHoursAgo }
    }).sort({ createdAt: -1 });
    
    console.log(`📊 Found ${recentReports.length} recent reports`);

    // Group reports by station ID (station field is a string like "rajiv-chowk")
    const stationReportsMap = {};
    
    recentReports.forEach(report => {
      const stationId = report.station; // This is already a string (stationId)
      
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
        
        const crowdValues = { low: 1, medium: 2, high: 3 };
        
        // Sort reports by newest first
        const sortedReports = stationReports.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        // Give MORE WEIGHT to the most recent reports (last 10 minutes)
        const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
        const veryRecentReports = sortedReports.filter(r => 
          new Date(r.createdAt) >= tenMinsAgo
        );
        
        let avgCrowd;
        
        if (veryRecentReports.length > 0) {
          console.log(`   Very recent reports: ${veryRecentReports.length}`);
          
          // If we have very recent reports (last 10 min), prioritize them heavily
          const recentAvg = veryRecentReports.reduce((sum, report) => {
            return sum + (crowdValues[report.crowdLevel] || 1);
          }, 0) / veryRecentReports.length;
          
          const olderReports = sortedReports.filter(r => 
            new Date(r.createdAt) < tenMinsAgo
          );
          
          if (olderReports.length > 0) {
            const olderAvg = olderReports.reduce((sum, report) => {
              return sum + (crowdValues[report.crowdLevel] || 1);
            }, 0) / olderReports.length;
            
            // Weight: 80% recent, 20% older
            avgCrowd = (recentAvg * 0.8) + (olderAvg * 0.2);
          } else {
            avgCrowd = recentAvg;
          }
        } else {
          // No very recent reports, use all reports equally
          avgCrowd = sortedReports.reduce((sum, report) => {
            return sum + (crowdValues[report.crowdLevel] || 1);
          }, 0) / sortedReports.length;
        }
        
        console.log(`   Average crowd score: ${avgCrowd.toFixed(2)}`);
        
        // Determine crowd level
        if (avgCrowd <= 1.4) crowdLevel = 'low';
        else if (avgCrowd <= 2.3) crowdLevel = 'medium';
        else crowdLevel = 'high';
        
        // OVERRIDE: If the MOST RECENT report is "high", show as high if avg > 2.0
        if (sortedReports.length > 0 && sortedReports[0].crowdLevel === 'high' && avgCrowd >= 2.0) {
          crowdLevel = 'high';
          console.log(`   Override: Most recent is HIGH, setting to high`);
        }
        
        console.log(`   Final level: ${crowdLevel}`);
      }

      return {
        _id: station._id,
        stationId: station.stationId,
        name: station.name,
        coordinates: station.coords.coordinates, // [lng, lat]
        lines: station.lines || [],
        isInterchange: station.lines && station.lines.length > 1,
        crowdLevel,
        reportCount,
        lastUpdated: stationReports.length > 0 ? stationReports[0].createdAt : null
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

    // Get recent reports (last 1 hour) - using stationId string
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentReports = await Report.find({
      station: station.stationId, // Use stationId string, not _id
      createdAt: { $gte: oneHourAgo }
    }).sort({ createdAt: -1 }).limit(10);

    console.log(`📊 Found ${recentReports.length} reports for ${station.name}`);

    // Calculate current crowd level with weighted recent reports
    const crowdMap = { low: 1, medium: 2, high: 3 };
    let currentCrowdLevel = 'low';
    
    if (recentReports.length > 0) {
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
      const veryRecentReports = recentReports.filter(r => 
        new Date(r.createdAt) >= tenMinsAgo
      );
      
      let avgCrowd;
      
      if (veryRecentReports.length > 0) {
        // Prioritize very recent reports
        const recentAvg = veryRecentReports.reduce((sum, report) => {
          return sum + (crowdMap[report.crowdLevel] || 1);
        }, 0) / veryRecentReports.length;
        
        const olderReports = recentReports.filter(r => 
          new Date(r.createdAt) < tenMinsAgo
        );
        
        if (olderReports.length > 0) {
          const olderAvg = olderReports.reduce((sum, report) => {
            return sum + (crowdMap[report.crowdLevel] || 1);
          }, 0) / olderReports.length;
          
          avgCrowd = (recentAvg * 0.8) + (olderAvg * 0.2);
        } else {
          avgCrowd = recentAvg;
        }
      } else {
        avgCrowd = recentReports.slice(0, 5).reduce((sum, report) => {
          return sum + (crowdMap[report.crowdLevel] || 1);
        }, 0) / Math.min(5, recentReports.length);
      }
      
      if (avgCrowd <= 1.4) currentCrowdLevel = 'low';
      else if (avgCrowd <= 2.3) currentCrowdLevel = 'medium';
      else currentCrowdLevel = 'high';
      
      // If most recent is "high", prioritize it
      if (recentReports[0].crowdLevel === 'high' && avgCrowd >= 2.0) {
        currentCrowdLevel = 'high';
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
        recentReports: recentReports.slice(0, 5).map(r => ({
          _id: r._id,
          crowdLevel: r.crowdLevel,
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
        const crowdValues = { low: 1, medium: 2, high: 3 };
        const avgCrowd = reports.reduce((sum, report) => {
          return sum + (crowdValues[report.crowdLevel] || 1);
        }, 0) / reports.length;
        
        if (avgCrowd <= 1.4) crowdLevel = 'low';
        else if (avgCrowd <= 2.3) crowdLevel = 'medium';
        else crowdLevel = 'high';
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
    console.error('❌ Nearby stations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nearby stations',
      error: error.message
    });
  }
};