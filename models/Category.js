const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
  duration: { type: Number, required: true }, // Duration in minutes
  testInstruction: { type: String, required: true },
  typeOfTest: { type: String, enum: ['Schedule Test', 'Mock Test'], required: true },
  schedule: {
    date: { type: Date },
    time: { type: String }
  },
  testMode: { type: String, enum: ['Single Time', 'Multiple Time'], required: true },
  tests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Test' }],
  expiredTestCount: { type: Number, default: 0 },
  createdBy: { type: String, required: true },
  testSubmitted: { type: String, default: 'pending' }, // New field
  noOfTestAttempted: { type: Number, default: 0 },
  companyId: { type: String, required: true },
});

module.exports = mongoose.model('Category', categorySchema);
