// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  meta: { type: Object, default: {} } // preferences, theme, language etc.
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
