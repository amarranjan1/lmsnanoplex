const express = require('express');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const User = require('../models/User'); 
const Company = require('../models/Company');
const { authenticateToken } = require('../middleware/authMiddleware');
const router = express.Router();


// Configure Multer for file uploads (CSV only)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

async function getCompanyId(req) {
  try {
    const email = req.user.email; // Get the email from the authenticated user
    console.log('Searching for company with email:', email);

    // First, try to find the companyId from the User model
    const user = await User.findOne({ email });
    if (user && user.companyId) {
      console.log('Found companyId in User:', user.companyId);
      return user.companyId;
    }

    // If not found in User, try to find it in the Company model
    const company = await Company.findOne({ email });
    if (company && company.companyId) {
      console.log('Found companyId in Company:', company.companyId);
      return company.companyId;
    }

    console.log('No companyId found');
    return null;
  } catch (error) {
    console.error('Error fetching company ID:', error);
    throw new Error('Failed to retrieve company ID');
  }
}


router.post('/bulk-register', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const users = [];
  
  // Create a readable stream from the buffer
  const stream = require('stream');
  const bufferStream = new stream.PassThrough();
  bufferStream.end(req.file.buffer); // End the stream with the buffer data

  try {
    // Fetch companyId using the logged-in user's email
    const companyId = await getCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ message: 'Company not found for the provided email' });
    }

    // Pipe the buffer stream to the csv-parser
    bufferStream.pipe(csvParser()).on('data', (row) => {
      const user = {
        name: row.name,
        email: row.email,
        password: row.password, // Encrypt password as needed
        role: row.role, // Ensure role is included
        companyId: companyId // Add companyId to the user
      };
      users.push(user);
    }).on('end', async () => {
      try {
        // Save users to the database
        for (const user of users) {
          const newUser = new User(user);
          await newUser.save();
        }
        res.status(200).json({ message: 'Users registered successfully!' });
      } catch (error) {
        res.status(500).json({ message: 'Error registering users', error });
      }
    }).on('error', (error) => {
      res.status(500).json({ message: 'Error processing CSV', error });
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching company ID', error });
  }
});


router.post('/register-manual', authenticateToken, async (req, res) => {
  const { name, email, password, role } = req.body;

  // Check if all required fields are provided
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Fetch companyId using the logged-in user's email
    const companyId = await getCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ message: 'Company not found for the provided email' });
    }

    // Create a new user with the associated companyId
    const newUser = new User({ name, email, password, role, companyId: companyId });
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully!' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
});


router.post('/bulk-delete', authenticateToken, async (req, res) => {
  const { emails } = req.body;

  if (!emails || emails.length === 0) {
    return res.status(400).json({ message: 'No emails provided' });
  }

  try {
    // Fetch companyId using the logged-in user's email
    const companyId = await getCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ message: 'Company not found for the provided email' });
    }

    console.log('Emails to delete:', emails);

    // Find users with the provided emails and matching companyId
    const usersToDelete = await User.find({ email: { $in: emails }, companyId: companyId });
    console.log('Users found:', usersToDelete);

    if (usersToDelete.length === 0) {
      return res.status(404).json({ message: 'No users found with the provided emails and matching company ID' });
    }

    // Delete users with matching companyId
    const result = await User.deleteMany({ email: { $in: emails }, companyId: companyId });

    if (result.deletedCount > 0) {
      res.status(200).json({ message: 'Users deleted successfully' });
    } else {
      res.status(404).json({ message: 'No users found with the provided emails and matching company ID' });
    }
  } catch (error) {
    console.error('Error deleting users:', error);
    res.status(500).json({ message: 'Error deleting users', error });
  }
});





module.exports = router;
