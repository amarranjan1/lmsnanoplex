const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const submissionSchema = new mongoose.Schema({
  testId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userId: { type: String, required: true }, // Changed from ObjectId to String
  userEmail: { type: String, required: true },
  userName: { type: String, required: true },
  userAnswers: { type: [String], required: true },  // Array of user answers
  score: { type: Number, required: true },  // Ensure score is saved as a number
  totalQuestions: { type: Number, required: true },
  submissionCount: { type: Number, default: 0 },
  testSubmitted: { type: String, default: 'pending' }, // New field
  noOfTestAttempted: { type: Number, default: 1 }, // New field
  categoryId: { type: String, required: true },
// Reference to Category
});



module.exports = mongoose.model('Submission', submissionSchema);
