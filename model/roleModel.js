const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
    name: { type: String, required: true },
    created_at: {
        type: Date,
        default: Date.now,
    },
});

const Role = mongoose.model('Role', roleSchema, 'roles'); 

module.exports = Role;
