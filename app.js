const express = require('express');
const mongoose = require('mongoose');
//const bcrypt = require('bcrypt');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { GridFSBucket } = require('mongodb');
const moment = require('moment-timezone');
const User = require('./models/User');
const nodemailer = require('nodemailer');
require('dotenv').config();
console.log('Database URL:', process.env.DATABASE_URL);
const { authenticateToken } = require('./middleware/authMiddleware');
const Test = require('./models/Test');
const Company = require('./models/Company');


const app = express();
const PORT = process.env.PORT || 5000;
// Access the environment variable
const JWT_SECRET = process.env.JWT_SECRET;
const authRoutes = require('./authRoutes'); 


// Setup Nodemailer transporter using environment variables
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
  },
  logger: true, // enable logging
  debug: true, 
});

const profileRoutes = require('./routes/profile'); 
const categoriesRouter = require('./routes/categories');
const testRoutes = require('./routes/tests');

const registrationRoutes = require('./routes/registration');
const assignTestRoutes = require('./routes/assigntest');
const resultRoutes = require('./routes/result');
const submissionRoutes = require('./routes/submission')

const companyRoutes = require('./routes/company')



// Get current time in Asia/Kolkata
const indiaTime24Hour = moment.tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss Z');
const indiaTime12Hour = moment.tz('Asia/Kolkata').format('YYYY-MM-DD hh:mm:ss A Z');

console.log('Current time in Asia/Kolkata (24-hour format):', indiaTime24Hour);
console.log('Current time in Asia/Kolkata (12-hour format with AM/PM):', indiaTime12Hour);



// Middleware
const corsOptions = {
  origin: ['https://lms.naoplex.in', 'https://creator-lac.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  
  credentials: true
};

// Allow requests from a specific origin
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://creator-lac.vercel.app');
  next();
});

app.use(cors(corsOptions));

app.options('*', cors());


app.use(bodyParser.json({ limit: '20mb' })); // Increased limit
app.use(bodyParser.urlencoded({ limit: '20mb', extended: true }));

// Configure multer for image upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(bodyParser.json());

/// Use the MongoDB URI from environment variables
const MONGODB_URI = process.env.MONGODB_URI;
console.log(MONGODB_URI);

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in .env file');
  process.exit(1);
}


mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));


const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

const bucket = new GridFSBucket(db, { bucketName: 'profileImages' });



// Middleware to parse JSON bodies
app.use(express.json());

// Helper function to generate JWT token
const generateToken = (user) => {
  return jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
};


// codes
async function getCompanyId(req) {
  try {
    const email = req.user.email; // Get the email from the authenticated user
    const role = req.user.role; // Assume role is available in the authenticated user object
    console.log('Searching for company with email:', email);

    if (role === 'Company') {
      // If role is Company, find the companyId from the Company model
      const company = await Company.findOne({ email });
      if (company && company.companyId) {
        console.log('Found companyId in Company:', company.companyId);
        return company.companyId;
      }
    } else {
      // Otherwise, find the companyId from the User model
      const user = await User.findOne({ email });
      if (user && user.companyId) {
        console.log('Found companyId in User:', user.companyId);
        return user.companyId;
      }
    }

    console.log('No companyId found');
    return null;
  } catch (error) {
    console.error('Error fetching company ID:', error);
    throw new Error('Failed to retrieve company ID');
  }
}



app.post('/registerUser', authenticateToken, upload.single('aadharCopy'), async (req, res) => {
  try {
    const { name, empId, email, password, dob, age, designation, aadharNumber, role } = req.body;

    console.log("Email:", email);

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Fetch companyId using the updated getCompanyId function
    const companyId = await getCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ message: 'Company not found for the provided email' });
    }

    const newUser = new User({
      name,
      empId,
      email,
      password,
      dob,
      age,
      designation,
      aadharNumber,
      role,
      companyId: companyId, // Assign the companyId to the user
      isVerified: true 
    });

    await newUser.save();
    
    if (req.file) {
      const uploadStream = bucket.openUploadStream(req.file.originalname);
      uploadStream.end(req.file.buffer);
      uploadStream.on('finish', async () => {
        await sendRegistrationEmail(name, email, password, designation);
        res.status(201).json({ message: 'User registered successfully and email sent' });
      });
      uploadStream.on('error', (err) => {
        res.status(500).json({ error: err.message });
      });
    } else {
      await sendRegistrationEmail(name, email, password, designation);
      res.status(201).json({ message: 'User registered successfully and email sent' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


async function sendRegistrationEmail(name, email, password, designation) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email, // Make sure this is the correct variable
    subject: 'Your Registration Details',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #dddddd; padding: 20px;">
        <!-- Header Section -->
        <div style="background-color: #00053c; padding: 10px; text-align: center; border-bottom: 1px solid #dddddd;">
          <h1 style="color: #ffffff; margin: 0;">NANOPLEX</h1>
        </div>

        <!-- Main Content Section -->
        <div style="padding: 20px; background-color: white;">
          <h2 style="color: #000000;">Welcome to NANOPLEX!</h2>
          <p>Dear ${name},</p>
          <p>We are excited to inform you that your registration has been successful! Below are your login details:</p>

          <table style="width: 100%; border-collapse: collapse; background-color: white;">
            <tr>
              <td style="padding: 8px; border: 1px solid #dddddd; background-color: #f7f7f7;"><strong>Email:</strong></td>
              <td style="padding: 8px; border: 1px solid #dddddd;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #dddddd; background-color: #f7f7f7;"><strong>Password:</strong></td>
              <td style="padding: 8px; border: 1px solid #dddddd;">${password}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #dddddd; background-color: #f7f7f7;"><strong>Designation:</strong></td>
              <td style="padding: 8px; border: 1px solid #dddddd;">${designation}</td>
            </tr>
          </table>

          <p style="margin-top: 20px; color: #000000;">Please keep this information safe and secure. If you have any questions, feel free to contact our support team.</p>
          <p>Thank you for being a part of NANOPLEX!</p>
        </div>

        <!-- Footer Section -->
        <div style="background-color: #00053c; padding: 10px; text-align: center; border-top: 1px solid #dddddd;">
          <p style="font-size: 12px; color: #ffffff;">&copy; 2025 NANOPLEX. All Rights Reserved.</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
  }
}



app.get('/fetchRegisterUserDetails', authenticateToken, async (req, res) => {
  try {
    // Fetch the companyId of the logged-in user
    const companyId = await getCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ message: 'Company not found for the logged-in user' });
    }

    // Fetch users with the same companyId
    const users = await User.find({ companyId: companyId });
    console.log('Fetched users:', users); // Log the fetched users
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: error.message });
  }
});


// Route to update user details
app.put('/editUserDetails/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const updates = req.body;

    // Check if the role of the user is allowed to perform this operation
    if (req.user.role !== 'Admin HR' && req.user.role !== 'Admin CEO' && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access Denied: Only Admin HR, Admin and Admin CEO can edit' });
    }

    // Ensure isVerified is true during updates
    updates.isVerified = true;

    // Fetch the current user details from the database
    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    let passwordChanged = false;
    
    // Check if the password has been changed
    if (updates.password && updates.password !== currentUser.password) {
      passwordChanged = true;  // Flag to indicate password change
    } else {
      delete updates.password; // Avoid updating the password if it's not changed
    }

    // Update the user details
    const user = await User.findByIdAndUpdate(userId, updates, { new: true });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if any of the role, designation, or password has been updated
    let sendEmail = false;
    let emailBody = `<p>Dear ${user.name},</p><p>Your account details have been updated:</p><ul>`;

    if (updates.role && updates.role !== currentUser.role) {
      emailBody += `<li><strong>Role:</strong> ${updates.role}</li>`;
      sendEmail = true;
    }
    if (updates.designation && updates.designation !== currentUser.designation) {
      emailBody += `<li><strong>Designation:</strong> ${updates.designation}</li>`;
      sendEmail = true;
    }
    if (passwordChanged) {
      emailBody += `<li><strong>Password:</strong> Your new password is: <strong>${updates.password}</strong></li>`;
      sendEmail = true;
    }

    emailBody += `</ul><p>If you have any questions or concerns, feel free to contact us.</p>`;

    // If any of the details changed, send the notification email
    if (sendEmail) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Your Account Details Have Been Updated',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #dddddd; padding: 20px;">
            <div style="background-color: #00053c; padding: 10px; text-align: center; border-bottom: 1px solid #dddddd;">
              <h1 style="color: #ffffff; margin: 0;">NANOPLEX</h1>
            </div>
            <div style="padding: 20px; background-color: white;">
              <h2 style="color: #000000;">Your Account Update Notification</h2>
              ${emailBody}
            </div>
            <div style="background-color: #00053c; padding: 10px; text-align: center; border-top: 1px solid #dddddd;">
              <p style="font-size: 12px; color: #ffffff;">&copy; 2025 NANOPLEX. All Rights Reserved.</p>
            </div>
          </div>
        `
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');
      } catch (error) {
        console.error('Error sending email:', error);
      }
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Error updating user details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Route to delete user
app.delete('/deleteUser/:id', authenticateToken, async (req, res) => {
  try {
    // Check user role
    if (req.user.role !== 'Admin HR' && req.user.role !== 'Admin CEO' && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Find and delete the user
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

   // Route to upload a new profile image
app.post('/uploadImage', authenticateToken, upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
  
    const email = req.user.email;
    const filename = `${email}_profile_image.png`;
  
    // Delete the old image if it exists
    const existingFiles = await bucket.find({ filename }).toArray();
    for (const file of existingFiles) {
      await bucket.delete(file._id);
    }
  
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: req.file.mimetype,
    });
  
    uploadStream.end(req.file.buffer);
  
    uploadStream.on('finish', () => {
      res.status(200).send('Image uploaded and replaced successfully');
    });
  
    uploadStream.on('error', (err) => {
      console.error('Upload error:', err);
      res.status(500).json({ error: 'Error uploading image' });
    });
  });

app.post('/uploadPdf', authenticateToken, upload.single('pdf'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
  
    const email = req.user.email;
    const filename = `${email}_user_pdf.pdf`;
    console.log(`Uploading PDF: ${filename}`);
  
    try {
      // Delete the old PDF if it exists
      const existingFiles = await bucket.find({ filename }).toArray();
      for (const file of existingFiles) {
        await bucket.delete(file._id);
      }
  
      // Upload the new PDF
      const uploadStream = bucket.openUploadStream(filename, {
        contentType: req.file.mimetype,
      });
  
      uploadStream.end(req.file.buffer);
  
      uploadStream.on('finish', () => {
        res.status(201).json({ message: 'File uploaded and replaced successfully', fileId: uploadStream.id });
      });
  
      uploadStream.on('error', (err) => {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Error uploading PDF' });
      });
  
    } catch (err) {
      console.error('Error during upload process:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Route to upload a new company logo
app.post('/uploadLogo', authenticateToken, upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
  
    const filename = `company_logo.png`;
  
    try {
      // Delete the old image if it exists
      const existingFiles = await bucket.find({ filename }).toArray();
      for (const file of existingFiles) {
        await bucket.delete(file._id);
      }
  
      const uploadStream = bucket.openUploadStream(filename, {
        contentType: req.file.mimetype,
      });
  
      uploadStream.end(req.file.buffer);
  
      uploadStream.on('finish', () => {
        res.status(200).send('Image uploaded and replaced successfully');
      });
  
      uploadStream.on('error', (err) => {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Error uploading image' });
      });
    } catch (err) {
      console.error('Error during upload process:', err);
      res.status(500).json({ error: 'Error during upload process' });
    }
  });

app.get('/fetchPdf', authenticateToken, async (req, res) => {
    try {
      const email = req.user.email;
      const filename = `${email}_user_pdf.pdf`;
  
      console.log(`Fetching pdf: ${filename}`);
  
      // Fetch pdf file from GridFS
      const files = await bucket.find({ filename }).toArray();
  
      if (files.length === 0) {
        console.log('PDF not found');
        return res.status(404).json({ error: 'PDF not found' });
      }
  
      const file = files[0];
      const downloadStream = bucket.openDownloadStream(file._id);
  
      res.set('Content-Type', file.contentType);
      downloadStream.pipe(res);
    } catch (err) {
      console.error('Error retrieving PDF:', err);
      res.status(500).json({ error: 'Error retrieving PDF' });
    }
  });
  
app.get('/fetchPdf/:email', authenticateToken, async (req, res) => {
    try {
      // Check user role for access control
      if (req.user.role !== 'Admin HR' && req.user.role !== 'Admin CEO' && req.user.role !== 'Admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
  
      // Extract email from request parameters
      const email = req.params.email;
      const filename = `${email}_user_pdf.pdf`;
  
      console.log(`Fetching PDF with filename: ${filename}`);
  
      // Fetch PDF file from GridFS
      const files = await bucket.find({ filename }).toArray();
      console.log('Files found:', files);
  
      if (files.length === 0) {
        console.log('No PDF found for filename:', filename);
        return res.status(404).json({ error: 'PDF not found' });
      }
  
      const file = files[0];
      const downloadStream = bucket.openDownloadStream(file._id);
  
      res.set('Content-Type', file.contentType);
      downloadStream.pipe(res);
    } catch (err) {
      console.error('Error retrieving PDF:', err);
      res.status(500).json({ error: 'Error retrieving PDF' });
    }
  });

app.get('/userDetails', authenticateToken, async (req, res) => {
    try {
      const email = req.user.email; // Assuming the user is identified by email
      const user = await User.findOne({ email }, 'name empId email designation role');
  
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      res.status(200).json(user);
    } catch (error) {
      console.error('Error fetching user details:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Route to fetch the user's profile image
app.get('/profileImage', authenticateToken, async (req, res) => {
    try {
      const email = req.user.email;
      const filename = `${email}_profile_image.png`;
  
      console.log(`Fetching image: ${filename}`);
  
      // Fetch image file from GridFS
      const files = await bucket.find({ filename }).toArray();
  
      if (files.length === 0) {
        console.log('Image not found');
        return res.status(404).json({ error: 'Image not found' });
      }
  
      const file = files[0];
      const downloadStream = bucket.openDownloadStream(file._id);
  
      res.set('Content-Type', file.contentType);
      downloadStream.pipe(res);
    } catch (err) {
      console.error('Error retrieving image:', err);
      res.status(500).json({ error: 'Error retrieving image' });
    }
  });
  
  
app.post('/changePassword', authenticateToken, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const email = req.user.email;
  
      // Find the user by email
      const user = await User.findOne({ email });
  
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      const passwordMatch = user.password === currentPassword;
  
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
  
      // Update the user's password
      user.password = newPassword;
  
      // Save the updated user
      await user.save();
  
      res.status(200).json({ message: 'Password changed successfully' });
    } catch (err) {
      console.error('Error changing password:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Route to fetch the company logo
app.get('/fetchLogo', async (req, res) => {
    try {
      const filename = `company_logo.png`;
  
      console.log(`Fetching image: ${filename}`);
  
      // Fetch image file from GridFS
      const files = await bucket.find({ filename }).toArray();
  
      if (files.length === 0) {
        console.log('Image not found');
        return res.status(404).json({ error: 'Image not found' });
      }
  
      const file = files[0];
      const downloadStream = bucket.openDownloadStream(file._id);
  
      res.set('Content-Type', file.contentType);
      downloadStream.pipe(res);
    } catch (err) {
      console.error('Error retrieving image:', err);
      res.status(500).json({ error: 'Error retrieving image' });
    }
  });
  

// codes end 


// Use routes
app.use('/', authRoutes);
app.use('/', profileRoutes);

app.use('/categories', categoriesRouter);
app.use('/tests', testRoutes);

app.use('/registration', registrationRoutes);

app.use('/assigntest', assignTestRoutes);
app.use('/result', resultRoutes);
app.use('/submission', submissionRoutes);
app.use('/company', companyRoutes);

// Example protected route
app.get('/protected', authenticateToken, (req, res) => {
  res.json({ message: 'This is a protected route', user: req.user });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
