// models/ReadingHistory.js
const mongoose = require('mongoose');

const ReadingHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  articleId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  category: {
    type: String,
    default: 'General'
  },
  timeSpent: {
    type: Number, // in seconds
    default: 0
  },
  views: {
    type: Number,
    default: 1
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { 
  timestamps: true 
});

// Compound indexes for efficient queries
ReadingHistorySchema.index({ userId: 1, createdAt: -1 });
ReadingHistorySchema.index({ userId: 1, category: 1 });
ReadingHistorySchema.index({ userId: 1, articleId: 1 });

module.exports = mongoose.model('ReadingHistory', ReadingHistorySchema);