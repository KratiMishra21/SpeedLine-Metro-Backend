import Report from "../models/report-community.js";
import { emitNewReport, emitReportLike } from "../utils/socket.js";

/**
 * POST /api/reports
 * Create a new crowd report
 */
export const createReport = async (req, res) => {
  try {
    const { station, level, remarks, userId, photo } = req.body;

    // Validation
    if (!station || !level || !userId) {
      return res.status(400).json({ 
        success: false,
        message: "Station, level, and userId are required" 
      });
    }

    if (!["low", "moderate", "high"].includes(level)) {
      return res.status(400).json({ 
        success: false,
        message: "Level must be 'low', 'moderate', or 'high'" 
      });
    }

    const newReport = new Report({
      station,
      level,
      remarks: remarks || "",
      userId,
      photo: photo || null,
      likes: 0,
      verified: false
    });

    const savedReport = await newReport.save();

    // Emit real-time update via Socket.IO
    try {
      await emitNewReport(savedReport);
    } catch (socketError) {
      console.error("Socket emission error:", socketError);
      // Don't fail the request if socket fails
    }

    res.status(201).json({
      success: true,
      message: "Report submitted successfully",
      data: savedReport
    });
  } catch (err) {
    console.error("Error creating report:", err);
    res.status(500).json({ 
      success: false,
      message: "Error creating report", 
      error: err.message 
    });
  }
};

/**
 * GET /api/reports
 * Get all reports with pagination and filtering
 */
export const getAllReports = async (req, res) => {
  try {
    const { station, level, page = 1, limit = 20, sortBy = "createdAt" } = req.query;
    
    const query = {};
    if (station) query.station = station;
    if (level) query.level = level;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reports = await Report.find(query)
      .sort({ [sortBy]: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    const totalReports = await Report.countDocuments(query);

    res.status(200).json({
      success: true,
      data: reports,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalReports / parseInt(limit)),
        totalReports: totalReports,
        hasMore: skip + reports.length < totalReports
      }
    });
  } catch (err) {
    console.error("Error fetching reports:", err);
    res.status(500).json({ 
      success: false,
      message: "Error fetching reports", 
      error: err.message 
    });
  }
};

/**
 * GET /api/reports/:id
 * Get a specific report by ID
 */
export const getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ 
        success: false,
        message: "Report not found" 
      });
    }

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (err) {
    console.error("Error fetching report:", err);
    res.status(500).json({ 
      success: false,
      message: "Error fetching report", 
      error: err.message 
    });
  }
};

/**
 * PATCH /api/reports/:id/like
 * Like a report
 */
export const likeReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ 
        success: false,
        message: "Report not found" 
      });
    }

    report.likes += 1;
    await report.save();

    // Emit real-time like update via Socket.IO
    try {
      emitReportLike(report._id, report.station, report.likes);
    } catch (socketError) {
      console.error("Socket emission error:", socketError);
    }

    res.status(200).json({
      success: true,
      message: "Report liked successfully",
      data: report
    });
  } catch (err) {
    console.error("Error liking report:", err);
    res.status(500).json({ 
      success: false,
      message: "Error liking report", 
      error: err.message 
    });
  }
};

/**
 * DELETE /api/reports/:id
 * Delete a report (admin/owner only)
 */
export const deleteReport = async (req, res) => {
  try {
    const { userId } = req.body; // In real app, get from auth middleware
    
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ 
        success: false,
        message: "Report not found" 
      });
    }

    // Check if user owns the report
    if (report.userId !== userId) {
      return res.status(403).json({ 
        success: false,
        message: "You don't have permission to delete this report" 
      });
    }

    await Report.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Report deleted successfully"
    });
  } catch (err) {
    console.error("Error deleting report:", err);
    res.status(500).json({ 
      success: false,
      message: "Error deleting report", 
      error: err.message 
    });
  }
};

/**
 * GET /api/reports/recent/:station
 * Get recent reports for a station (last 2 hours)
 */
export const getRecentReports = async (req, res) => {
  try {
    const { station } = req.params;
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const reports = await Report.find({
      station: station,
      createdAt: { $gte: twoHoursAgo }
    })
    .sort({ createdAt: -1 })
    .select('-__v');

    res.status(200).json({
      success: true,
      station: station,
      count: reports.length,
      data: reports,
      timeRange: "Last 2 hours"
    });
  } catch (err) {
    console.error("Error fetching recent reports:", err);
    res.status(500).json({ 
      success: false,
      message: "Error fetching recent reports", 
      error: err.message 
    });
  }
};