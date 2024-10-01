


const mongoose = require('mongoose');

const { Schema, Types } = mongoose;

const dataSchema = new Schema({
    userId: { type: String },
    email: { type: String },
    category_flag: { type: String },
    company_name: { type: String },
    batchId: { type: String, required: true },
    name: { type: String },
    lastAccessed: { type: Date },
    is_Open:{ type: String },
    created_at: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('company_locks', dataSchema);

