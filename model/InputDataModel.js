const mongoose = require('mongoose');

const { Schema, Types } = mongoose;

const dataSchema = new Schema({
  ManufacturerId: { type: Number, required: true },
  ManufacturerCatalogNumber: { type: String, required: true },
  ItemDescription: { type: String, required: true },
  ticker: String, 
  category_flag: String, 
});

module.exports = mongoose.model('input_datas', dataSchema);
