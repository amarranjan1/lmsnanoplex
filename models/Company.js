// models/Company.js
const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
    companyName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    address: { type: String, required: true },
    role: { type: String, enum: ['Company'], default: 'Company' },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Reference to users
    companyId: { type: String, unique: true } // Add companyId if needed
}, {
    timestamps: true,
});



const Company = mongoose.model('Company', companySchema);

module.exports = Company;
