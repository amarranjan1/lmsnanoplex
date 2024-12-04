const express = require('express');
const router = express.Router();
const AssignTest = require('../models/AssignTest');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/assign-test', async (req, res) => {
  const { emails, testTitles, assignedBy } = req.body;

  if (!emails || !testTitles || !assignedBy) {
    return res.status(400).json({ message: 'Emails, test titles, and assignedBy are required' });
  }

  try {
    const updatePromises = emails.map(async (email) => {
      const existingRecord = await AssignTest.findOne({ email });

      let updatedTestTitles = testTitles;
      if (existingRecord) {
        // Merge existing test titles with new ones, avoiding duplicates
        updatedTestTitles = Array.from(new Set([...existingRecord.testTitles, ...testTitles]));
      }

      return AssignTest.updateOne(
        { email },
        {
          $set: { testTitles: updatedTestTitles, assignedBy },
          $inc: { testCount: updatedTestTitles.length - (existingRecord ? existingRecord.testTitles.length : 0) }
        },
        { upsert: true }
      );
    });

    await Promise.all(updatePromises);

    res.status(200).json({ message: 'Tests assigned successfully' });
  } catch (error) {
    console.error('Error assigning tests:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// GET /assign-test/:email
router.get('/assign-test/:email', authenticateToken, async (req, res) => {
  const { email } = req.params;

  try {
    const assignTest = await AssignTest.findOne({ email });

    if (!assignTest) {
      return res.status(404).json({ message: 'No tests found for this email' });
    }

    res.status(200).json({ testTitles: assignTest.testTitles });
  } catch (error) {
    console.error('Error fetching test titles:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /assign-test/count/:email
router.get('/assign-test/count/:email', authenticateToken, async (req, res) => {
  const { email } = req.params;

  try {
    const count = await AssignTest.countDocuments({ email });

    res.status(200).json({ count });
  } catch (error) {
    console.error('Error counting assigned tests:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /assign-test/assigned-by/:email count total
router.get('/assign-test/assigned-by/:email', authenticateToken, async (req, res) => {
  const { email } = req.params;

  try {
    // Count the number of documents where assignedBy matches the given email
    const count = await AssignTest.countDocuments({ assignedBy: email });

    res.status(200).json({ count });
  } catch (error) {
    console.error('Error counting assigned tests by user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



module.exports = router;
