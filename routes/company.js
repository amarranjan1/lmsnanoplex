// routes/company.js
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const Company = require('../models/Company');
const User = require('../models/User');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Company registration route
// routes/companyRoutes.js
router.post('/register-company', async (req, res) => {
    try {
        const { companyName, email, password, phoneNumber, address } = req.body;

        const existingCompany = await Company.findOne({ email });
        if (existingCompany) {
            return res.status(400).json({ error: 'Company email already exists' });
        }

        // Generate a unique companyId if needed
        const companyId = new mongoose.Types.ObjectId().toString();

        const newCompany = new Company({ companyName, email, password, phoneNumber, address, companyId });
        await newCompany.save();

        const token = jwt.sign({ email: newCompany.email, role: newCompany.role }, JWT_SECRET);
        res.status(201).json({ message: 'Company registered successfully', token, companyId: newCompany.companyId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});




module.exports = router;
