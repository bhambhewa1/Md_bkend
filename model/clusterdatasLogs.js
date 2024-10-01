const mongoose = require('mongoose');

const clusterdatasLogs = new mongoose.Schema({
  data: Object,
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'BatchesHistory', required: true },
  created_date: {
    type: Date,
    required: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actionType: String
});

const ClusterdatasLogs = mongoose.model('ClusterdatasLogs', clusterdatasLogs);

module.exports = ClusterdatasLogs;