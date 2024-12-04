// models/AssignTest.js
const mongoose = require('mongoose');

const AssignTestSchema = new mongoose.Schema({
  email: { type: String, required: true },
  testTitles: [{ type: String, required: true }],
  assignedAt: { type: Date, default: Date.now },
  testCount: { type: Number, default: 0 },
  assignedBy: { type: String, required: true },

});

module.exports = mongoose.model('AssignTest', AssignTestSchema);
