const mongoose = require('mongoose');

const businessProfileSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false, // Optional for unauthenticated users initially, but ready for Phase 3 integration
        },
        ownerName: {
            type: String,
            required: [true, 'Owner name is required'],
            trim: true,
            maxlength: [100, 'Owner name cannot exceed 100 characters'],
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        gstin: {
            type: String,
            trim: true,
            maxlength: [15, 'GSTIN cannot exceed 15 characters'],
        },
        city: {
            type: String,
            required: [true, 'City is required'],
            trim: true,
            maxlength: [100, 'City cannot exceed 100 characters'],
        },
        businessType: {
            type: String,
            required: [true, 'Business type is required'],
            trim: true,
            maxlength: [150, 'Business type cannot exceed 150 characters'],
        },
        items: [{
            type: String,
            trim: true,
        }],
    },
    { timestamps: true }
);

module.exports = mongoose.model('BusinessProfile', businessProfileSchema);
