const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
    ticker: { type: String, required: true },
    company: { type: String, required: true },
    created_at: {
        type: Date,
        default: Date.now,
    },
});


const CompanyModel = mongoose.model('companys', CompanySchema, 'companys'); 

module.exports = CompanyModel;
