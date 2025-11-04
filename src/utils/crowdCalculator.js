import Report from "../models/report-community.js";

/**
 * Smart Crowd Level Calculator
 * Calculates crowd level based on:
 * - Recent reports (time-weighted)
 * - Like counts (credibility)
 * - Frequency of same status
 */

export const calculateCrowdLevel = async (stationId) => {
  try {
    // Get reports from last 2 hours (most relevant)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    const recentReports = await Report.find({
      station: stationId,
      createdAt: { $gte: twoHoursAgo }
    }).sort({ createdAt: -1 });

    if (recentReports.length === 0) {
      return {
        level: "moderate", // Default when no data
        confidence: 0,
        reportCount: 0,
        lastUpdated: null
      };
    }

    // Calculate weighted scores for each level
    const scores = { low: 0, moderate: 0, high: 0 };
    let totalWeight = 0;

    recentReports.forEach((report) => {
      // Time decay factor (newer = more weight)
      const ageMinutes = (Date.now() - report.createdAt.getTime()) / (1000 * 60);
      const timeWeight = Math.exp(-ageMinutes / 60); // Exponential decay over 60 mins

      // Credibility factor (likes = more trustworthy)
      const credibilityWeight = 1 + Math.log(report.likes + 1) * 0.3;

      // Combined weight
      const weight = timeWeight * credibilityWeight;

      scores[report.level] += weight;
      totalWeight += weight;
    });

    // Normalize scores
    Object.keys(scores).forEach(level => {
      scores[level] = totalWeight > 0 ? scores[level] / totalWeight : 0;
    });

    // Determine final level (highest score)
    const finalLevel = Object.keys(scores).reduce((a, b) => 
      scores[a] > scores[b] ? a : b
    );

    // Confidence based on agreement and report count
    const maxScore = scores[finalLevel];
    const confidence = Math.min(100, Math.round(
      maxScore * 100 * Math.min(1, recentReports.length / 5)
    ));

    return {
      level: finalLevel,
      confidence: confidence,
      reportCount: recentReports.length,
      lastUpdated: recentReports[0].createdAt,
      distribution: {
        low: Math.round(scores.low * 100),
        moderate: Math.round(scores.moderate * 100),
        high: Math.round(scores.high * 100)
      }
    };
  } catch (error) {
    console.error("Error calculating crowd level:", error);
    return {
      level: "moderate",
      confidence: 0,
      reportCount: 0,
      lastUpdated: null,
      error: error.message
    };
  }
};

/**
 * Get hourly crowd trends for a station
 */
export const getHourlyTrends = async (stationId) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const reports = await Report.find({
      station: stationId,
      createdAt: { $gte: twentyFourHoursAgo }
    }).sort({ createdAt: 1 });

    // Group by hour
    const hourlyData = Array(24).fill(null).map((_, i) => ({
      hour: i,
      low: 0,
      moderate: 0,
      high: 0,
      total: 0
    }));

    reports.forEach(report => {
      const hour = new Date(report.createdAt).getHours();
      hourlyData[hour][report.level]++;
      hourlyData[hour].total++;
    });

    // Calculate dominant level per hour
    const trends = hourlyData.map(data => {
      if (data.total === 0) return { hour: data.hour, level: null };
      
      const dominant = data.high > data.moderate && data.high > data.low ? "high" :
                      data.moderate > data.low ? "moderate" : "low";
      
      return {
        hour: data.hour,
        level: dominant,
        counts: {
          low: data.low,
          moderate: data.moderate,
          high: data.high
        },
        total: data.total
      };
    });

    return trends;
  } catch (error) {
    console.error("Error fetching hourly trends:", error);
    return [];
  }
};

/**
 * Get crowd levels for all stations
 */
export const getAllStationsCrowdLevels = async (stations) => {
  try {
    const crowdData = await Promise.all(
      stations.map(async (station) => {
        const crowdInfo = await calculateCrowdLevel(station.stationId);
        return {
          ...station.toObject(),
          crowdLevel: crowdInfo.level,
          crowdConfidence: crowdInfo.confidence,
          reportCount: crowdInfo.reportCount,
          lastUpdated: crowdInfo.lastUpdated
        };
      })
    );

    return crowdData;
  } catch (error) {
    console.error("Error getting all stations crowd levels:", error);
    throw error;
  }
};

/**
 * Get nearby stations with crowd info
 */
export const getNearbyStations = async (longitude, latitude, maxDistance = 2000) => {
  try {
    const Station = (await import("../models/station.js")).default;
    
    const nearbyStations = await Station.find({
      coords: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude]
          },
          $maxDistance: maxDistance
        }
      }
    }).limit(10);

    const withCrowdInfo = await getAllStationsCrowdLevels(nearbyStations);
    return withCrowdInfo;
  } catch (error) {
    console.error("Error fetching nearby stations:", error);
    throw error;
  }
};