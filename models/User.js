// models/User.js
const mongoose = require('mongoose');
const moment = require('moment-timezone');

const convertToUTC = (date) => {
    const dateFormat = 'DD-MM-YYYY';
    return moment.tz(date, dateFormat, 'Asia/Kolkata').utc().toDate();
};

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['User', 'Admin CEO', 'Admin HR', 'Admin', 'Travel Agency'], required: true },
    empId: String,
    dob: {
        type: Date,
        set: function(value) {
            return convertToUTC(value);
        }
    },
    age: Number,
    designation: String,
    aadharNumber: String,
    isVerified: { type: Boolean, default: false },
    otp: { type: String },
    companyId: { type: String },
}, {
    timestamps: true,
});

const User = mongoose.model('User', userSchema);

module.exports = User;
