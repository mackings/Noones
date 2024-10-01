const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv').config();
const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    
    // Track daily clock in/out times
    dailyClockTimes: [
        {
            clockInTime: { type: Date, default: null },
            clockOutTime: { type: Date, default: null }
        }
    ],
    
    // Track trades assigned and paid
    assignedTrades: [
        {
            tradeId: { type: String, required: true },
            tradeDetails: { type: Object } // Replace with trade details schema if available
        }
    ],
    
    paidTrades: [
        {
            tradeId: { type: String, required: true },
            tradeDetails: { type: Object } // Replace with trade details schema if available
        }
    ],

    // Staff role
    role: { type: String, required: true }, // Replace rank with role

    clockedIn: { type: Boolean, default: false },
    clockInTime: { type: Date, default: null },
    clockOutTime: { type: Date, default: null }
});

const Allstaff = mongoose.model('Staff', staffSchema); // Update model name for clarity
module.exports = Allstaff;