const mongoose = require("mongoose");

// Trade Details Schema
const tradeDetailsSchema = new mongoose.Schema({
  account: { type: String },
  amountPaid: { type: String, default: null },
  assignedAt: { type: Date },
  fiat_amount_requested: { type: String },
  handle: { type: String },
  isPaid: { type: Boolean, default: false },
  markedAt: { type: String, default: null },
  name: { type: String },
  trade_hash: { type: String }
});

// Payroll Schema to track payment details
const payrollSchema = new mongoose.Schema({
  date: { type: Date },
  amount: { type: Number },
  month: { type: String },
  year: { type: Number }
});

// Reply Schema for queries
const replySchema = new mongoose.Schema({
  sender: { type: String },
  message: { type: String },
  timestamp: { type: Date, default: Date.now }
});

// Query Schema to track queries raised by HR
const querySchema = new mongoose.Schema({
  queryText: { type: String },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null },
  status: { 
    type: String, 
    enum: ['unresolved', 'resolved'], 
    default: 'unresolved' 
  },
  notes: { type: String, default: null },
  replies: [replySchema]
});

// Message Schema to track messages between HR and staff
const messageSchema = new mongoose.Schema({
  sender: { type: String },
  recipient: { type: String },
  message: { type: String },
  sentAt: { type: Date, default: Date.now },
  replies: [replySchema]
});

const staffSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: { type: String },

  // Track daily clock in/out times
  dailyClockTimes: [
    {
      clockInTime: { type: Date, default: null },
      clockOutTime: { type: Date, default: null }
    }
  ],

  // Track trades assigned and paid
  assignedTrades: [tradeDetailsSchema],
  paidTrades: [tradeDetailsSchema],

  // Staff role
  role: { type: String },

  // Track clock-in status
  clockedIn: { type: Boolean, default: false },
  clockInTime: { type: Date, default: null },
  clockOutTime: { type: Date, default: null },

  // Additions for staff salary details
  level: { type: String },
  basicSalary: { type: Number },
  pay: { type: Number, default: 0 },
  incentives: { type: Number, default: 0 },
  debt: { type: Number, default: 0 },
  penalties: { type: Number, default: 0 },
  payables: { type: Number, default: 0 },
  savings: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  netSalary: { type: Number, default: 0 },

  // Payroll details
  payroll: [payrollSchema],

  // Queries raised by HR
  queries: [querySchema],

  // Messages between HR and staff
  messages: [messageSchema]
});

const Allstaff = mongoose.model('Staff', staffSchema);

module.exports = Allstaff;
