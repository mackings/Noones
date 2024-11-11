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

// Payroll Schema to track payment details and salary

const payrollSchema = new mongoose.Schema({
  date: { type: Date },
  amount: { type: Number },
  month: { type: String },
  year: { type: Number },
  level: { type: String },
  basicSalary: { type: Number },
  daysOfWork: { type: Number, default: 0 }, // Added daysOfWork field
  pay: { type: Number, default: 0 },
  incentives: { type: Number, default: 0 },
  debt: { type: Number, default: 0 },
  penalties: { type: Number, default: 0 },
  payables: { type: Number, default: 0 },
  savings: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  netSalary: { type: Number, default: 0 }
});


// Reply Schema for queries
const replySchema = new mongoose.Schema({
  sender: { type: String },       // Username or HR identifier
  message: { type: String },
  senderRole: { type: String, enum: ['hr', 'staff'], required: true }, // Added to track role (HR or Staff)
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


const bankSchema = new mongoose.Schema({
  bankName: { type: String, required: true, trim: true },
  bankAccountName: { type: String, required: true, trim: true },
  bankAccountNumber: { type: String, required: true, unique: true, trim: true },
  amount: { type: Number, required: true }, // Removed min: 0 to allow negative balances
  availability: { type: Boolean, default: true },
  status: { 
    type: String, 
    enum: ['available', 'in use', 'unavailable'], 
    default: 'available' 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});




const inflowSchema = new mongoose.Schema({
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
  amount: { type: Number, required: true },
  inflowDate: { type: Date, default: Date.now }
});


const staffSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  name: { type: String, unique: true },
  email: { type: String, unique: true },
  password: { type: String },

  // Track daily clock in/out times
  dailyClockTimes: [
    {
      clockInTime: { type: Date, default: null },
      clockOutTime: { type: Date, default: null }
    }
  ],

  assignedTrades: [tradeDetailsSchema],
  paidTrades: [tradeDetailsSchema],

  role: { type: String },

  clockedIn: { type: Boolean, default: false },
  clockInTime: { type: Date, default: null },
  clockOutTime: { type: Date, default: null },

  // Payroll details with salary information
  payroll: [payrollSchema],

  // Queries raised by HR
  queries: [querySchema],

  // Messages between HR and staff
  messages: [messageSchema],
  banks: [bankSchema],
  lastBankChoice: { type: Date, default: null },
  currentBankId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', default: null },
});


const Allstaff = mongoose.model('Staff', staffSchema);
const Bank = mongoose.model("Bank", bankSchema);
const Inflow = mongoose.model('Inflow', inflowSchema);

module.exports = { Allstaff, Bank, Inflow };
