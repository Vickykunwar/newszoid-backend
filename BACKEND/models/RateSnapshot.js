const mongoose = require('mongoose');

const rateSnapshotSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    itemKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    businessType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    snapshotDate: {
      type: String,
      required: true,
      index: true,
    },
    fetchedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    unit: {
      type: String,
      default: 'Rs/unit',
      trim: true,
    },
    currentPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    market: {
      type: String,
      default: '',
      trim: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    confidence: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'LOW'],
      default: 'LOW',
    },
    sourceName: {
      type: String,
      default: '',
      trim: true,
    },
    sourceUrl: {
      type: String,
      default: '',
      trim: true,
    },
    sourceDate: {
      type: String,
      default: '',
      trim: true,
    },
    // Set only after the server fetched the cited page and found both the
    // requested item and quoted price. Historic AI-only records stay false
    // and are excluded from comparison/alert calculations.
    sourceVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

rateSnapshotSchema.index(
  { itemKey: 1, businessType: 1, city: 1, snapshotDate: 1 },
  { unique: true }
);

module.exports = mongoose.model('RateSnapshot', rateSnapshotSchema);
