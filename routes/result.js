// Import necessary models
const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Submission = require('../models/Submission');
const authenticateToken = require('../middleware').authenticateToken;
const Company = require('../models/Company');
const User = require('../models/User');

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

// Endpoint to get categories and user results created by the logged-in user
router.get('/created-by', authenticateToken, async (req, res) => {
  const userEmail = req.user.email; // Get the email from the authenticated user

  try {
    // Find categories created by the logged-in user
    const categories = await Category.find({ createdBy: userEmail }).populate('tests');

    if (!categories.length) {
      return res.status(404).json({ message: 'No categories found for this user' });
    }

    // Prepare the response with categories and their respective submissions
    const response = await Promise.all(categories.map(async (category) => {
      const submissions = await Submission.find({ testId: { $in: category.tests.map(test => test._id) } });

      return {
        category: {
          title: category.title,
          description: category.description,
          typeOfTest: category.typeOfTest,
          testMode: category.testMode,
        },
        tests: category.tests.map(test => ({
          testId: test._id,
          title: test.title,
          submissions: submissions.filter(submission => submission.testId.toString() === test._id.toString()).map(submission => ({
            userEmail: submission.userEmail,
            userName: submission.userName, // Include userName in the response
            score: submission.score,
            totalQuestions: submission.totalQuestions,
            userAnswers: submission.userAnswers,
            noOfTestAttempted: submission.noOfTestAttempted,
          })),
        })),
      };
    }));

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching categories and user results:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
});


// Endpoint to get the leaderboard for the user's company
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    // Get the companyId for the logged-in user
    const companyId = await getCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ message: 'Company ID not found for the user' });
    }

    // Aggregate submissions to get top 20 users by score within the same company
    const leaderboard = await Submission.aggregate([
      {
        $lookup: {
          from: 'users', // Assuming the collection name is 'users'
          localField: 'userEmail',
          foreignField: 'email',
          as: 'userDetails'
        }
      },
      { $unwind: '$userDetails' },
      { $match: { 'userDetails.companyId': companyId } }, // Filter by companyId
      {
        $group: {
          _id: '$userEmail',
          userName: { $first: '$userDetails.name' }, // Assuming userName is stored in userDetails
          totalScore: { $sum: '$score' },
        },
      },
      { $sort: { totalScore: -1 } }, // Sort by totalScore in descending order
      { $limit: 20 }, // Limit to top 20
    ]);

    // Assign ranks to the users
    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      userName: entry.userName,
      userEmail: entry._id,
      totalScore: entry.totalScore,
    }));

    res.status(200).json(rankedLeaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
});




// Endpoint to get the user's own test results
router.get('/user-scores', authenticateToken, async (req, res) => {
  const userEmail = req.user.email; // Get the email from the authenticated user

  try {
    // Find all submissions for the authenticated user
    const submissions = await Submission.find({ userEmail });

    if (!submissions.length) {
      return res.status(404).json({ message: 'No test results found for this user' });
    }

    // Prepare the response with test details and user results
    const response = await Promise.all(submissions.map(async (submission) => {
      // Find the category to get the test name
      const category = await Category.findOne({ tests: submission.testId });

      return {
        testName: category ? category.title : 'Unknown Test', // Get the test name from the category
        testId: submission.testId,
        score: submission.score,
        totalQuestions: submission.totalQuestions,
        userAnswers: submission.userAnswers,
        attempts: submission.noOfTestAttempted,
      };
    }));

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching user test results:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
});





module.exports = router;
