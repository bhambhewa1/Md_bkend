const mongoose = require("mongoose");

const clusterdatasArchives = new mongoose.Schema({
  data: Object,
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: "BatchesHistory", required: true },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

const ClusterdatasArchives = mongoose.model(
  "ClusterdatasArchives",
  clusterdatasArchives
);

module.exports = ClusterdatasArchives;
