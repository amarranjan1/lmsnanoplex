const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const Category = require('../models/Category');
const AssignTest = require('../models/AssignTest');
const { authenticateToken } = require('../middleware/authMiddleware');

// Fetch submissions by category
router.get('/submissions/categories', authenticateToken, async (req, res) => {
    try {
        const { categoryIds } = req.query; // Expecting categoryIds to be a comma-separated string
        const userEmail = req.user.email; // Assuming the email is attached to the request by the authenticateToken middleware

        if (!categoryIds) {
            return res.status(400).json({ message: 'No category IDs provided' });
        }

        const categoryIdArray = categoryIds.split(',').map(id => id.trim());

        // Validate if the categories exist
        const categories = await Category.find({ _id: { $in: categoryIdArray } });

        if (!categories.length) {
            return res.status(404).json({ message: 'Categories not found' });
        }

        // Fetch submissions linked to the categories and the user's email
        const submissions = await Submission.find({
            categoryId: { $in: categoryIdArray },
            userEmail: userEmail
        })
            .populate('testId', 'title') // Populate test details (optional)
            .select('userId userEmail userName score testSubmitted noOfTestAttempted categoryId');

        if (!submissions.length) {
            return res.status(404).json({ message: 'No submissions found for these categories and user' });
        }

        console.log('Fetched Submissions for Categories and User:', submissions);
        res.status(200).json({ categories, submissions });
    } catch (error) {
        console.error('Error fetching submissions by categories and user:', error);
        res.status(500).json({ message: 'Internal server error', error });
    }
});

router.get('/DDDcategories-with-submissions', async (req, res) => {
    try {
        const categories = await Category.find();
        const submissions = await Submission.find({ userEmail: req.query.userEmail });

        const categoriesWithSubmissions = categories.map(category => {
            const submission = submissions.find(sub => sub.categoryId.toString() === category._id.toString());
            return {
                ...category.toObject(),
                testSubmitted: submission ? submission.testSubmitted : 'Not Submitted',
                noOfTestAttempted: submission ? submission.noOfTestAttempted : 0
            };
        });

        res.status(200).json(categoriesWithSubmissions);
    } catch (error) {
        console.error('Error fetching categories and submissions:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/EEEEcategories-with-submissions', async (req, res) => {
    try {
        const userEmail = req.query.userEmail;
        if (!userEmail) {
            return res.status(400).json({ message: 'User email is required' });
        }

        // Fetch assigned test titles for the user
        const assignedTests = await AssignTest.findOne({ email: userEmail });
        if (!assignedTests) {
            return res.status(404).json({ message: 'No tests assigned to this user' });
        }

        // Fetch categories that match the assigned test titles
        const categories = await Category.find({ title: { $in: assignedTests.testTitles } });
        const submissions = await Submission.find({ userEmail });

        const categoriesWithSubmissions = categories.map(category => {
            const submission = submissions.find(sub => sub.categoryId.toString() === category._id.toString());
            return {
                ...category.toObject(),
                testSubmitted: submission ? submission.testSubmitted : 'Not Submitted',
                noOfTestAttempted: submission ? submission.noOfTestAttempted : 0
            };
        });

        res.status(200).json(categoriesWithSubmissions);
    } catch (error) {
        console.error('Error fetching categories and submissions:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


router.get('/categories-with-submissions', async (req, res) => {
    try {
        const userEmail = req.query.userEmail;
        if (!userEmail) {
            return res.status(400).json({ message: 'User email is required' });
        }

        const assignedTests = await AssignTest.findOne({ email: userEmail });
        if (!assignedTests) {
            return res.status(404).json({ message: 'No tests assigned to this user' });
        }

        const categories = await Category.find({ title: { $in: assignedTests.testTitles } });
        const submissions = await Submission.find({ userEmail });

        const categoriesWithSubmissions = categories.map(category => {
            const submission = submissions.find(sub => sub.categoryId.toString() === category._id.toString());
            return {
                ...category.toObject(),
                submission: {
                    testSubmitted: submission ? submission.testSubmitted : 'Not Submitted',
                    noOfTestAttempted: submission ? submission.noOfTestAttempted : 0
                }
            };
        });

        res.status(200).json(categoriesWithSubmissions);
    } catch (error) {
        console.error('Error fetching categories and submissions:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


module.exports = router;
