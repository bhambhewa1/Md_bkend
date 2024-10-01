const mongoose = require('mongoose');

const { Schema, Types } = mongoose;

const approvedMatchesLogs = new Schema({
  ticker: String, 
  category_flag: String,
  manufacturerId: { type: String },
  manufacturerCatalogNumber: { type: String },
  itemDescription: { type: String },
  group: String, 
  company: String, 
  business: String, 
  division: String, 
  therapy: String, 
  specialty: String, 
  anatomy: String, 
  subAnatomy: String, 
  productCategory: String, 
  productFamily: String, 
  model: String, 
  index: String, 
  embedding: String, 
  fuzzy: String, 
  total: String, 
  productCode: String, 
  productCodeName: String, 
  approval_status: Number, 
  comment: String, 
  isEditRow: Number, 
  batchId:{type: mongoose.Schema.Types.ObjectId,ref: 'BatchesHistory', required: true},
  approvalDate:{type: Date},
  userId:{type: mongoose.Schema.Types.ObjectId,ref: 'User'},
  actionType:String, 
  approvedHistory:String
});

module.exports = mongoose.model('ApprovedMatchesLogs', approvedMatchesLogs);