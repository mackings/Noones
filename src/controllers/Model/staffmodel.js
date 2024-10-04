const mongoose = require("mongoose");


// Trade Details Schema

const tradeDetailsSchema = new mongoose.Schema({
  account: { type: String, required: true },
  amountPaid: { type: String, default: null },
  assignedAt: { type: Date, required: true },
  fiat_amount_requested: { type: String, required: true },
  handle: { type: String, required: true },
  isPaid: { type: Boolean, default: false },
  markedAt: { type: String, default: null },
  name: { type: String, required: true },
  trade_hash: { type: String, required: true }
});

// Payroll Schema to track payment details
const payrollSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  amount: { type: Number, required: true },
  month: { type: String, required: true },
  year: { type: Number, required: true }
});

// Reply Schema for queries

const replySchema = new mongoose.Schema({
  sender: { type: String, required: true },   
  message: { type: String, required: true },  
  timestamp: { type: Date, default: Date.now } 
});

// Query Schema to track queries raised by HR

const querySchema = new mongoose.Schema({
  queryText: { type: String, required: true },      
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
  sender: { type: String, required: true },        
  recipient: { type: String, required: true },     
  message: { type: String, required: true },      
  sentAt: { type: Date, default: Date.now },  
  replies: [replySchema]   
});

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
  assignedTrades: [tradeDetailsSchema],
  paidTrades: [tradeDetailsSchema],

  // Staff role
  role: { type: String, required: true },

  // Track clock-in status
  clockedIn: { type: Boolean, default: false },
  clockInTime: { type: Date, default: null },
  clockOutTime: { type: Date, default: null },

  // Additions for staff salary details

  level: { type: String, required: true },              
  basicSalary: { type: Number, required: true },       
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
