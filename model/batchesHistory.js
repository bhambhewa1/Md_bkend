const mongoose = require("mongoose");

const batchesHistory = new mongoose.Schema({
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(),
    auto: true,
  },
  batchName: { type: String, required: true },
  created_date: {
    type: Date,
    required: true,
  },
  batch_date: {
    type: Date,
    default: Date.now,
  },
  ticker: { type: String, required: true },
  total_records: { type: Number, required: true },
  total_clustered: { type: Number, default: null },
  total_exact: { type: Number, default: null },
  total_approved: { type: Number, default: 0 },
  batchEndDate: { type: Date, default: null },
  is_active: {
    type: Number,
    default: 1,
    min: 0, // Minimum value for tinyInt
    max: 1, // Maximum value for tinyInt
  },
});
// 
const BatchesHistory = mongoose.model(
  "BatchesHistory",
  batchesHistory,
  "batches_history_analytics"
);

module.exports = BatchesHistory;
