const mongoose = require('mongoose');

const { Schema, Types } = mongoose;
const Master_data_set = new mongoose.Schema({
    created_date: {
        type: String,
        required: true,
    },
    total_records: {
        type: Number,
        required: true,
    },
    total_company: {
        type: Number,
        required: true,
    },
    created_at: {
        type: Date,
        default: Date.now,
    }
});

const MasterDatasetModel = mongoose.model('master_data_sets', Master_data_set);

module.exports = mongoose.model('master_data_sets', Master_data_set);