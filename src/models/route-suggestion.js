const mongoose = require('mongoose');

const routeSuggestionSchema = new mongoose.Schema({
  startStation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Station',
    required: true
  },
  endStation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Station',
    required: true
  },
  routes: [{
    path: [{
      station: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Station'
      },
      line: String,
      arrivalTime: Number, // minutes from start
      crowdLevel: String // 'low', 'medium', 'high'
    }],
    totalDistance: Number, // in km
    estimatedTime: Number, // in minutes
    transferCount: Number,
    crowdScore: Number, // 0-100, lower is better
    overallScore: Number, // combined score
    recommendation: String // 'fastest', 'least-crowded', 'balanced'
  }],
  requestedAt: {
    type: Date,
    default: Date.now
  },
  preferences: {
    avoidCrowds: Boolean,
    minimizeTransfers: Boolean,
    departureTime: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('RouteSuggestion', routeSuggestionSchema);