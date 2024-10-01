const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    loginToken: { type: String, required: true },
    role: { type: String, required: true },
    created_at: {
        type: Date,
        default: Date.now,
    },
});

const User = mongoose.model('User', userSchema, 'users'); 

module.exports = User;
