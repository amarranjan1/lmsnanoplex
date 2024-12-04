const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  type: { type: String, required: true },
  question: { type: String, required: true },
  options: { type: [String], required: false },
  correctAnswers: { type: [String], required: false },
});

const testSchema = new mongoose.Schema({
  title: { type: String, required: true },
  duration: { type: Number, required: false },
  instructions: { type: String, required: false },
  imageUrl: { type: String, required: false },
  questions: { type: [questionSchema], required: true },
  submissionCount: { type: Number, default: 0 },
  companyId: { type: String, required: true },
  categoryId: { type: String, required: true },
  
});

module.exports = mongoose.model('Test', testSchema);
