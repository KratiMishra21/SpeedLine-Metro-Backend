// controllers/reportController.js
import Report from "../models/report-community.js";  // ← Change this line

// Submit a new crowd report
export const submitReport = async (req, res) => {
  try {
    const { station, level, remarks, userId } = req.body;

    console.log("📝 Submitting report:", { station, level, remarks, userId });

    if (!station || !level || !userId) {
      return res.status(400).json({
        error: "Station, level, and userId are required",
      });
    }

    const newReport = new Report({
      station,
      level,
      remarks: remarks || "",
      userId,
    });

    await newReport.save();
    console.log("✅ Report saved:", newReport._id);

    res.status(201).json({
      success: true,
      message: "Report submitted successfully",
      report: {
        id: newReport._id,
        station: newReport.station,
        level: newReport.level,
        remarks: newReport.remarks,
        userId: newReport.userId,
        createdAt: newReport.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Error submitting report:", error.message);
    res.status(500).json({ 
      error: error.message,
      details: error.toString()
    });
  }
};

// Get all recent reports
export const getReports = async (req, res) => {
  try {
    const { limit = 12, station } = req.query;

    console.log("📊 Fetching reports - limit:", limit, "station:", station);

    let filter = {};
    if (station) {
      filter.station = { $regex: station, $options: "i" };
    }

    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const formattedReports = reports.map((report) => ({
      id: report._id,
      station: report.station,
      level: report.level,
      remarks: report.remarks,
      userId: report.userId,
      likes: report.likes,
      timeAgo: getTimeAgo(report.createdAt),
      timestamp: report.createdAt.getTime(),
    }));

    console.log(`✅ Fetched ${formattedReports.length} reports`);

    res.status(200).json({
      success: true,
      count: formattedReports.length,
      reports: formattedReports,
    });
  } catch (error) {
    console.error("❌ Error fetching reports:", error.message);
    res.status(500).json({
      error: error.message,
    });
  }
};

// Get reports for a specific station
export const getReportsByStation = async (req, res) => {
  try {
    const { station } = req.params;
    const { limit = 10 } = req.query;

    console.log("🔍 Fetching reports for station:", station);

    const reports = await Report.find({ station })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const formattedReports = reports.map((report) => ({
      id: report._id,
      station: report.station,
      level: report.level,
      remarks: report.remarks,
      timeAgo: getTimeAgo(report.createdAt),
      timestamp: report.createdAt.getTime(),
    }));

    console.log(`✅ Found ${formattedReports.length} reports for ${station}`);

    res.status(200).json({
      success: true,
      station,
      count: formattedReports.length,
      reports: formattedReports,
    });
  } catch (error) {
    console.error("❌ Error fetching station reports:", error.message);
    res.status(500).json({
      error: error.message,
    });
  }
};

// Get crowd status summary for all stations
export const getCrowdSummary = async (req, res) => {
  try {
    console.log("📈 Generating crowd summary");

    const summary = await Report.aggregate([
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: "$station",
          level: { $first: "$level" },
          remarks: { $first: "$remarks" },
          lastUpdate: { $first: "$createdAt" },
          reportCount: { $sum: 1 },
        },
      },
      {
        $sort: { lastUpdate: -1 },
      },
    ]);

    const formattedSummary = summary.map((item) => ({
      station: item._id,
      level: item.level,
      remarks: item.remarks,
      lastUpdate: getTimeAgo(item.lastUpdate),
      reportCount: item.reportCount,
    }));

    console.log(`✅ Generated summary for ${formattedSummary.length} stations`);

    res.status(200).json({
      success: true,
      stationCount: formattedSummary.length,
      summary: formattedSummary,
    });
  } catch (error) {
    console.error("❌ Error fetching crowd summary:", error.message);
    res.status(500).json({
      error: error.message,
    });
  }
};

// Helper function to format time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
  return `${Math.floor(seconds / 2592000)} months ago`;
}