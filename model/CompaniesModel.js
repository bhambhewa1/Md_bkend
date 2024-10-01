const mongoose = require("mongoose");

const CompanieSchema = new mongoose.Schema({
  ticker: { type: String, required: true },
  company: { type: String, required: true },
  fetch_date: {
    type: Date,
    default: Date.now,
  },
  total_record_fetch: { type: Number, required: true },
  created_date: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    default: "Pending",
  },
});

const CompaniesModel = mongoose.model("companies", CompanieSchema, "companies");

module.exports = CompaniesModel;
