const mongoose = require("mongoose");

const eventsHistory = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  eventName: { type: String, required: true },
  created_at: {
    type: Date,
    default: Date.now,
  },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: "BatchesHistory", required: true },
});

const EventsHistory = mongoose.model(
  "EventsHistory",
  eventsHistory,
  "EventsHistory"
);

module.exports = EventsHistory;
