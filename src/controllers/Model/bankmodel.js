
const mongoose = require('mongoose');

const bankSchema = new mongoose.Schema({
    bankName: {
        type: String,
        required: true,
        trim: true,
    },
    bankAccountNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    closingBalance: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
    },
    availability: {
        type: Boolean,
        default: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

bankSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const Bank = mongoose.model('Bank', bankSchema);

module.exports = Bank;

