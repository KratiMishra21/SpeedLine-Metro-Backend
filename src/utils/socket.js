import { Server } from "socket.io";
import { calculateCrowdLevel } from "./crowdCalculator.js";

let io;

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join station-specific room
    socket.on("join-station", (stationId) => {
      socket.join(`station-${stationId}`);
      console.log(`Client ${socket.id} joined station-${stationId}`);
    });

    // Leave station room
    socket.on("leave-station", (stationId) => {
      socket.leave(`station-${stationId}`);
      console.log(`Client ${socket.id} left station-${stationId}`);
    });

    // Join all stations room (for map view)
    socket.on("join-map", () => {
      socket.join("map-view");
      console.log(`Client ${socket.id} joined map view`);
    });

    // Leave map room
    socket.on("leave-map", () => {
      socket.leave("map-view");
      console.log(`Client ${socket.id} left map view`);
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

/**
 * Emit new report to all clients watching that station
 */
export const emitNewReport = async (report) => {
  const io = getIO();
  
  // Calculate updated crowd level
  const crowdInfo = await calculateCrowdLevel(report.station);
  
  // Emit to station-specific room
  io.to(`station-${report.station}`).emit("new-report", {
    report: report,
    crowdLevel: crowdInfo.level,
    crowdConfidence: crowdInfo.confidence,
    reportCount: crowdInfo.reportCount,
    timestamp: new Date()
  });

  // Emit to map view (all stations)
  io.to("map-view").emit("station-update", {
    stationId: report.station,
    crowdLevel: crowdInfo.level,
    crowdConfidence: crowdInfo.confidence,
    reportCount: crowdInfo.reportCount,
    timestamp: new Date()
  });
};

/**
 * Emit report like update
 */
export const emitReportLike = (reportId, station, newLikeCount) => {
  const io = getIO();
  
  io.to(`station-${station}`).emit("report-liked", {
    reportId: reportId,
    likes: newLikeCount,
    timestamp: new Date()
  });
};