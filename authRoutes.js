const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const Company = require('./models/Company');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false // Allow self-signed certificates if needed
    }
});


transporter.verify((error, success) => {
    if (error) {
        console.log('Server not ready: ', error);
    } else {
        console.log('Server is ready to take our messages');
    }
});


console.log(`Email User: ${EMAIL_USER}`);
console.log(`Email Pass: ${EMAIL_PASS}`);

// Signup route
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Validate role
        const validRoles = ['User', 'Admin CEO', 'Admin HR','Admin', 'Travel Agency'];
        const selectedRole = validRoles.includes(role) ? role : 'User';  // Default to 'User'
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role selected' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Generate OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const newUser = new User({ name, email, password, role, otp });
        await newUser.save();

        // Send OTP email
        const mailOptions = {
            from: EMAIL_USER,
            to: email,
            subject: 'Your OTP for Signup',
            text: `Your OTP is ${otp}`
        };

        await transporter.sendMail(mailOptions);
        res.status(201).json({ message: 'OTP sent to your email. Please verify to complete the registration.' });
    } catch (err) {
        console.error(err); // Added logging for debugging
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
});

// OTP verification route
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    try {
        // Find the user by email and OTP
        const user = await User.findOne({ email, otp });

        if (!user) {
            return res.status(400).json({ message: 'Invalid OTP or email' });
        }

        // Update the isVerified field to true
        user.isVerified = true;
        user.otp = null; // Optionally clear the OTP after verification
        await user.save();

        res.status(200).json({ message: 'Email verified successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Middleware to check if email is verified
const checkEmailVerified = async (req, res, next) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    const user = await User.findOne({ email });
    if (!user) {
        return res.status(400).json({ error: 'User not found' });
    }
    if (!user.isVerified) {
        return res.status(400).json({ error: 'Email not verified' });
    }
    next();
};

   
// Login route
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if the user exists in the User collection
        let user = await User.findOne({ email });
        let role = 'User';

        if (!user) {
            // If not found in User, check the Company collection
            user = await Company.findOne({ email });
            role = 'Company';
        }

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Compare password (assuming passwords are stored in plain text)
        const passwordMatch = user.password === password;
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = jwt.sign({ email: user.email, role: user.role || role }, JWT_SECRET);
        res.json({ token, role: user.role || role });
    } catch (err) {
        console.error('Error logging in:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});


module.exports = router;
