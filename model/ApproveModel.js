const mongoose = require("mongoose");

const { Schema, Types } = mongoose;

const ApprovedataSchema = new Schema({
  ticker: String,
  category_flag: String,
  ManufacturerId: { type: String },
  ManufacturerCatalogNumber: { type: String },
  ItemDescription: { type: String },
  Group: String,
  Company: String,
  Business: String,
  Division: String,
  Therapy: String,
  Specialty: String,
  Anatomy: String,
  SubAnatomy: String,
  ProductCategory: String,
  ProductFamily: String,
  Model: String,
  index: String,
  embedding: String,
  fuzzy: String,
  Total: String,
  productCode: String,
  created_date: {
    type: Date,
    required: true,
  },
  productCodeName: String,
  approval_status: Number,
  comment: String,
  isEditRow: Number,

  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BatchesHistory",
    required: true,
  },
  approveDate: {
    type: Date,
    // Date.now() executes the function immediately and sets current date at the time of schema creation, not when a new document is created.
    default: Date.now, // It will be executed every time a new document is created
  },
  published: Boolean,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

module.exports = mongoose.model("approveclusters", ApprovedataSchema);
