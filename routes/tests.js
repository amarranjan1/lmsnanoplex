const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Category = require('../models/Category');
const Test = require('../models/Test'); // Import the Test model
const { authenticateToken } = require('../middleware/authMiddleware');
const Submission = require('../models/Submission');
const { Parser } = require('json2csv');
const AssignTest = require('../models/AssignTest');
const User = require('../models/User');
const Company = require('../models/Company');

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

// Create a new test under a category
router.post('/:categoryId/tests', authenticateToken, async (req, res) => {
  const { categoryId } = req.params;
  const { title, instructions, imageUrl, questions } = req.body;

  try {
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Get the companyId using the getCompanyId function
    const companyId = await getCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ message: 'Company ID not found for the user' });
    }

    // Create a new Test document
    const newTest = new Test({
      title,
      instructions,
      imageUrl,
      questions,
      categoryId: categoryId, // Reference to the category
      companyId: companyId, // Include the companyId
    });

    // Save the Test document
    await newTest.save();

    // Optionally, push the Test's ObjectId to the category
    category.tests.push(newTest._id);
    await category.save();

    res.status(201).json(newTest);
  } catch (error) {
    console.error(error); // Log the error for server diagnostics
    res.status(500).json({ message: 'Error creating test', error });
  }
});


// Get tests for a specific category
router.get('/:categoryId/tests', authenticateToken, async (req, res) => {
  const { categoryId } = req.params;
  try {
    const category = await Category.findById(categoryId).populate('tests');
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json(category.tests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tests', error });
  }
});



// Update an existing test
router.put('/:testId', authenticateToken, async (req, res) => {
  const { testId } = req.params;
  const { title, instructions, imageUrl, questions } = req.body;

  try {
    const updatedTest = await Test.findByIdAndUpdate(testId, {
      title,
      instructions,
      imageUrl,
      questions
    }, { new: true });

    if (!updatedTest) {
      return res.status(404).json({ message: 'Test not found' });
    }

    res.status(200).json(updatedTest);
  } catch (error) {
    res.status(500).json({ message: 'Error updating test', error: error.message });
  }
});

// Delete a specific test
router.delete('/:testId', authenticateToken, async (req, res) => {
  const { testId } = req.params;

  try {
    const deletedTest = await Test.findByIdAndDelete(testId);
    if (!deletedTest) {
      return res.status(404).json({ message: 'Test not found' });
    }

    // Optionally, remove the Test's ObjectId from the related category
    const category = await Category.findOne({ tests: testId });
    if (category) {
      category.tests.pull(testId);
      await category.save();
    }

    res.status(200).json({ message: 'Test deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting test', error });
  }
});

router.post('/submit/:testId', async (req, res) => {
  try {
    const { userAnswers, userEmail, score, totalQuestions } = req.body;
    const { testId } = req.params;

    // Check if score and totalQuestions are valid numbers
    const parsedScore = parseInt(score, 10);
    const parsedTotalQuestions = parseInt(totalQuestions, 10);

    if (isNaN(parsedScore) || isNaN(parsedTotalQuestions)) {
      return res.status(400).json({ message: 'Invalid score or totalQuestions' });
    }

    // Fetch the user's name from the User model
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userName = user.name; // Ensure userName is fetched

    // Fetch the categoryId from the Category model
    const category = await Category.findOne({ tests: new mongoose.Types.ObjectId(testId) });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const categoryId = category._id; // Get the categoryId

    // Check if a submission already exists for this user and test
    const existingSubmission = await Submission.findOne({ testId, userEmail });

    if (existingSubmission) {
      // Update the existing submission
      existingSubmission.userAnswers = userAnswers;
      existingSubmission.score = parsedScore;
      existingSubmission.totalQuestions = parsedTotalQuestions;
      existingSubmission.submissionCount += 1; // Increment submission count
      existingSubmission.noOfTestAttempted += 1; // Increment noOfTestAttempted
      existingSubmission.userName = userName; // Update userName
      existingSubmission.categoryId = categoryId; // Update categoryId

      // Update testSubmitted status if noOfTestAttempted is greater than 0
      if (existingSubmission.noOfTestAttempted > 0) {
        existingSubmission.testSubmitted = 'submitted';
      }

      await existingSubmission.save();
    } else {
      // Create a new submission document
      const newSubmission = new Submission({
        testId: new mongoose.Types.ObjectId(testId),
        userId: userEmail,
        userEmail,
        userName, // Include user's name
        userAnswers,
        score: parsedScore,
        totalQuestions: parsedTotalQuestions,
        submissionCount: 1, // Initialize submissionCount to 1 for a new submission
        testSubmitted: 'submitted', // Set testSubmitted to 'submitted' for new submissions
        noOfTestAttempted: 1, // Initialize noOfTestAttempted to 1
        categoryId, // Include categoryId
      });

      // Save the new submission to MongoDB
      await newSubmission.save();
    }

    res.status(201).json({ message: 'Test submitted successfully' });
  } catch (error) {
    console.error('Error submitting test:', error); // Log the error
    res.status(500).json({ message: 'Failed to submit test' });
  }
});

// Count total number of submitted tests for a user
router.get('/user/:email/submissions/count', authenticateToken, async (req, res) => {
  const { email } = req.params; // Get the email from the request parameters

  try {
    // Count the number of submissions for the given email
    const submissionCount = await Submission.countDocuments({ userEmail: email });
 
    res.status(200).json({ email, submissionCount });
  } catch (error) {
    console.error('Error counting submissions:', error);
    res.status(500).json({ message: 'Error counting submissions', error });
  }
});




module.exports = router;
