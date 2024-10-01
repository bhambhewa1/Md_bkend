const mongoose = require('mongoose');

const clusterTableSchema = new mongoose.Schema({
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'BatchesHistory', required: true },
  created_at: {
    type: Date,
    default: Date.now,
  },
  data: Object,
});

const ClusterTableModel = mongoose.model('clusterdatas', clusterTableSchema);

module.exports = ClusterTableModel;
