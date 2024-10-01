
const mongoose = require('mongoose');

const disapprove_history = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', },
    ManufacturerId: { type: Number, required: true },
    ManufacturerCatalogNumber: { type: String, required: true },
    ItemDescription: { type: String, required: true },
    ticker: String, 
    category_flag: String,
    created_date: {
      type: Date,
      required: true,
    }, 
    // Exact_point: Object,
    // Clustered_point: Array,
    created_at: {
        type: Date,
        default: Date.now
      },
}, { strict: false }); // Set the schema to non-strict mode, so that donot give error if any field insert without defined in schema

const DisapproveHistory = mongoose.model('disapprove_history', disapprove_history);

module.exports = DisapproveHistory;
