const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const User = require('../models/User');
const Company = require('../models/Company');
const { authenticateToken } = require('../middleware/authMiddleware'); // Make sure this imports the correct function
const moment = require('moment-timezone');
const cron = require('node-cron')
const AssignTest = require('../models/AssignTest');

// Schedule a task to run every day at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    const categories = await Category.find({ typeOfTest: 'Schedule Test' });
    const now = moment().tz('UTC').toDate();

    for (const category of categories) {
      if (category.schedule && category.schedule.date < now) {
        // Increment expiredTestCount if the scheduled date is in the past
        category.expiredTestCount += 1;
        await category.save();
      }
    }
    console.log('Expired tests updated successfully');
  } catch (error) {
    console.error('Error updating expired tests:', error);
  }
});

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

  // Create a new category
  router.post('/', authenticateToken, async (req, res) => {
    const { title, description, image, duration, testInstruction, typeOfTest, schedule, testMode } = req.body;
    const createdBy = req.user.email; // Assuming the email is stored in req.user by the authenticateToken middleware
  
    try {
      // Fetch the companyId using the getCompanyId function
      const companyId = await getCompanyId(req);
      if (!companyId) {
        return res.status(400).json({ message: 'Company ID not found for the user' });
      }
  
      if (schedule && schedule.date) {
        schedule.date = moment.tz(schedule.date, 'YYYY-MM-DDTHH:mm:ss', 'UTC').toDate();
      }
  
     
  
      // Include  and companyId in the new category
      const newCategory = new Category({
        title,
        description,
        image,
        duration,
        testInstruction,
        typeOfTest,
        schedule,
        testMode,
        createdBy,
        companyId // Add the companyId here
      });
  
      await newCategory.save();
      res.status(201).json(newCategory);
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ message: 'Error creating category', error });
    }
  });
  


router.get('/', authenticateToken, async (req, res) => {
  try {
    // Fetch the companyId using the getCompanyId function
    const companyId = await getCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ message: 'Company ID not found for the user' });
    }

    // Get the email from the authenticated user
    const email = req.user.email;

    // Find all AssignTest records for the user's email
    const assignTests = await AssignTest.find({ email });

    // Extract all assignedBy values from the AssignTest records
    const assignedByEmails = assignTests.map(assignTest => assignTest.assignedBy);

    // Find categories that match the companyId and either:
    // 1. createdBy is in the list of assignedByEmails
    // 2. createdBy matches the user's email
    const categories = await Category.find({
      companyId,
      $or: [
        { createdBy: { $in: assignedByEmails } },
        { createdBy: email }
      ]
    });

    res.status(200).json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories', error });
  }
});



// Delete a category by ID
router.delete('/:id', authenticateToken, async (req, res) => {
  console.log(`Received request to delete category with ID: ${req.params.id}`); // Log the request
  try {
    const deletedCategory = await Category.findByIdAndDelete(req.params.id);

    if (!deletedCategory) {
      console.error(`Category with ID ${req.params.id} not found`);
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error); // Log the error details
    res.status(500).json({ message: 'Error deleting category', error });
  }
});


// Express route to update a category
router.put('/:id', authenticateToken, async (req, res) => {
  const { title, description, image, duration, testInstruction, typeOfTest, testMode, schedule } = req.body;
  try {
    // Ensure the date is in ISO 8601 format
    if (schedule && schedule.date) {
      // Parse the date and set it to a fixed time (e.g., noon) to avoid time zone issues
      schedule.date = moment.tz(schedule.date, 'YYYY-MM-DDTHH:mm:ss', 'UTC').toDate();
    }

   

    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      { title, description, image, duration, testInstruction, typeOfTest, testMode, schedule },
      { new: true, runValidators: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json(updatedCategory);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Error updating category', error });
  }
});

// Get expired test count for all categories
router.get('/expired-tests/count', authenticateToken, async (req, res) => {
  try {
    const categories = await Category.find({}, 'title expiredTestCount');
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching expired test counts', error });
  }
});


// Endpoint to count total number of categories created by a specific email
router.get('/categories/count/:email', authenticateToken, async (req, res) => {
  const { email } = req.params; // Get the email from the request parameters

  try {
    // Count the number of categories created by the specified email
    const categoryCount = await Category.countDocuments({ createdBy: email });

    res.status(200).json({ email, categoryCount });
  } catch (error) {
    console.error('Error counting categories:', error);
    res.status(500).json({ message: 'Error counting categories', error });
  }
});

module.exports = router;
