
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv').config();
const Staff = require("../Model/staffmodel");
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const responseController = require("../Utils/responses");
const admin = require("firebase-admin");
const cron = require("node-cron");
const db = admin.firestore();
const serviceAccount = require("../Utils/firebaseservice");

const { Allstaff, Bank, Inflow } = require("../Model/staffmodel");







const addNewStaff = async (staffId, staffDetails) => {
    try {
        const staffRef = db.collection('Allstaff').doc(staffId);

        await staffRef.set({
            ...staffDetails,
            assignedTrades: [], // Initialize with empty trades
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Staff ${staffId} added to Firestore and ready to receive trades.`);
    } catch (error) {
        console.error('Error adding new staff to Firestore:', error);
        throw new Error('FirestoreError'); // Throw an error if Firestore addition fails
    }
};


// Firestore function to update staff clockedIn status
const updateClockedInStatus = async (staffId, status) => {
    try {
        const staffRef = db.collection('Allstaff').doc(staffId);

        await staffRef.update({
            clockedIn: status,
        });

        console.log(`Staff ${staffId} clocked in status updated to ${status}.`);
    } catch (error) {
        console.error('Error updating clockedIn status in Firestore:', error);
        throw new Error('FirestoreUpdateError'); // Throw an error if Firestore update fails
    }
};


// Register staff
exports.registerStaff = async (req, res) => {
    try {
        const { username, password, name, email, role } = req.body;

        // Check if the staff already exists in MongoDB
        const existingStaff = await Allstaff.findOne({ username });
        if (existingStaff) {
            return responseController.errorResponse(res, 'Staff already exists', null, 400);
        }

        // Hash the password and create the staff member in MongoDB
        const hashedPassword = await bcrypt.hash(password, 10);
        const newStaff = new Allstaff({
            username,
            password: hashedPassword,
            name,
            email,
            role, 
            assignedTrades: [], 
            paidTrades: [],
            clockedIn: false,
        });
        await newStaff.save(); // Save to MongoDB

        // Add the staff to Firestore
        const staffDetailsForFirestore = {
            name,
            email,
            role, // Include role for Firestore
            username,
            assignedTrades: [], // Ensure this is included for Firestore
            timestamp: new Date(), // Add timestamp if necessary
        };

        await addNewStaff(newStaff.username.toString(), staffDetailsForFirestore);

        // Return success response after both MongoDB and Firestore have been updated
        return responseController.successResponse(res, 'Staff registered successfully', newStaff, 201);
    } catch (error) {
        console.error('Error registering staff:', error);

        // Handle specific Firestore error
        if (error.message === 'FirestoreError') {
            return responseController.errorResponse(res, 'Error adding staff to Firestore', error, 500);
        }

        // General error handler
        return responseController.errorResponse(res, 'Error registering staff', error, 500);
    }
};

// Login staff

exports.loginStaff = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if the staff exists
        const staff = await Allstaff.findOne({ username });
        if (!staff) {
            return responseController.errorResponse(res, 'Invalid username or password', null, 400);
        }

        // Compare the passwords
        const isMatch = await bcrypt.compare(password, staff.password);
        if (!isMatch) {
            return responseController.errorResponse(res, 'Invalid username or password', null, 400);
        }

        // Generate JWT token
        const token = jwt.sign({ id: staff._id, username: staff.username }, JWT_SECRET, {
            expiresIn: '1h',
        });

        // Remove password and other sensitive fields before returning the user object
        const user = {
            _id: staff._id,
            username: staff.name,
            email: staff.email,
            role: staff.role,
            bank:staff.banks
            // Add other fields you'd like to return
        };

        // Return the user object along with the token
        return responseController.successResponse(res, 'Login successful', { token, user });
    } catch (error) {
        return responseController.errorResponse(res, 'Error logging in', error);
    }
};


// Clock in
exports.clockIn = async (req, res) => {
    try {
        const { token } = req.body;

        // Verify the token
        const decoded = jwt.verify(token, JWT_SECRET);
        const staff = await Allstaff.findById(decoded.id);

        if (!staff) {
            return responseController.notFoundResponse(res, 'Staff not found');
        }

        // Check if the staff is already clocked in
        if (staff.clockedIn) {
            return responseController.errorResponse(res, 'Already clocked in', null, 400);
        }

        // Update clock-in status and add to dailyClockTimes array
        staff.clockedIn = true;
        const clockInTime = new Date();
        staff.dailyClockTimes.push({ clockInTime });
        staff.clockInTime = clockInTime; // Track the current session's clock-in time
        await staff.save();

        // Update Firestore clockedIn status
        await updateClockedInStatus(staff.username.toString(), true);

        return responseController.successResponse(res, 'Clocked in successfully', { clockInTime });
    } catch (error) {
        return responseController.errorResponse(res, 'Error clocking in', error);
    }
};

// Clock out
exports.clockOut = async (req, res) => {
    try {
        const { token } = req.body;
        const decoded = jwt.verify(token, JWT_SECRET);
        const staff = await Allstaff.findById(decoded.id);

        if (!staff) {
            return responseController.notFoundResponse(res, 'Staff not found');
        }

        if (!staff.clockedIn) {
            return responseController.errorResponse(res, 'Not clocked in', null, 400);
        }

        // Update clock-out time and set clockedIn to false
        staff.clockedIn = false;
        const clockOutTime = new Date();
        staff.clockOutTime = clockOutTime;

        // Update the most recent clock-in entry in the dailyClockTimes array
        const lastClockIn = staff.dailyClockTimes.pop();
        lastClockIn.clockOutTime = clockOutTime;
        staff.dailyClockTimes.push(lastClockIn); // Re-add the updated record
        await staff.save();

        // Update Firestore clockedIn status
        await updateClockedInStatus(staff.username.toString(), false);

        return responseController.successResponse(res, 'Clocked out successfully', { clockOutTime });
    } catch (error) {
        return responseController.errorResponse(res, 'Error clocking out', error);
    }
};

exports.getstaffs = async (req, res) => {
    try {
        const staffMembers = await Allstaff.find({}, '-password');

        // Return the staff members
        return res.status(200).json({
            success: true,
            data: staffMembers,
        });
    } catch (error) {
        console.error('Error fetching staff:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching staff',
            error: error.message,
        });
    }
};


exports.getStaffByName = async (req, res) => {

    try {
        const { name } = req.params;

        // Find the staff member by name
        const staff = await Allstaff.findOne({ name }).populate('banks'); // Populating bank details

        if (!staff) {
            return responseController.errorResponse(res, 'Staff member not found', null, 404);
        }

        // Remove sensitive fields like password before returning the data
        const staffData = {
            _id: staff._id,
            username: staff.username,
            name: staff.name,
            email: staff.email,
            role: staff.role,
            clockedIn: staff.clockedIn,
            dailyClockTimes: staff.dailyClockTimes,
            assignedTrades: staff.assignedTrades,
            paidTrades: staff.paidTrades,
            payroll: staff.payroll,
            queries: staff.queries,
            messages: staff.messages,
            clockInTime: staff.clockInTime,
            clockOutTime: staff.clockOutTime,
            banks: staff.banks, 
        };

        return responseController.successResponse(res, 'Staff member data retrieved successfully', staffData);
    } catch (error) {
        return responseController.errorResponse(res, 'Error fetching staff data', error);
    }
};




// Create a new bank

exports.createBank = async (req, res) => {
    const { bankName, bankAccountNumber, bankAccountName } = req.body;

    if (!bankName || !bankAccountNumber || !bankAccountName) {
        return res.status(400).json({
            success: false,
            message: 'Please provide bankName, bankAccountNumber, and bankAccountName'
        });
    }

    try {
        const newBank = new Bank({
            bankName,
            bankAccountName,
            bankAccountNumber,
            amount: 0,  // Default amount is 0
            availability: false,  // Default availability is false
            status: 'unavailable',  // Default status is 'unavailable'
            createdAt: Date.now(),
            updatedAt: Date.now()
        });

        await newBank.save();

        return res.status(200).json({
            success: true,
            message: 'Bank created successfully',
            data: newBank
        });
    } catch (error) {
        console.log('Error creating bank:', error);
        return res.status(500).json({
            success: false,
            message: 'Error creating bank',
            error: error.message
        });
    }
};



exports.addMoneyToBank = async (req, res) => {
    const { bankId, amountToAdd } = req.body;

    if (!bankId || amountToAdd === undefined) {
        return res.status(400).json({
            success: false,
            message: 'Please provide bankId and amountToAdd',
        });
    }

    try {
        // Find the bank by its ID
        const bank = await Bank.findById(bankId);
        if (!bank) {
            return res.status(404).json({
                success: false,
                message: 'Bank not found',
            });
        }

        // Calculate the new amount, handling any negative balance
        if (bank.amount < 0) {
            const deficit = Math.abs(bank.amount); // Amount needed to clear the negative balance
            if (amountToAdd > deficit) {
                bank.amount = amountToAdd - deficit; // Set balance after clearing negative
            } else {
                bank.amount += amountToAdd; // Not enough to clear negative, add to the current balance
            }
        } else {
            bank.amount += amountToAdd; // Regular addition if balance is non-negative
        }

        // Only update availability and status if the bank is not in use
        // We don't change status if the bank is in use
        if (bank.status !== 'in use') {
            bank.availability = bank.amount > 0;
            bank.status = bank.amount > 0 ? 'available' : 'unavailable';
        }

        // Update the `updatedAt` timestamp
        bank.updatedAt = Date.now();

        // Save the updated bank document
        await bank.save();

        // Update all staff members with this bank in their `banks` array
        await Allstaff.updateMany(
            { 'banks._id': bankId },
            { $set: { 'banks.$.amount': bank.amount } }
        );

        return res.status(200).json({
            success: true,
            message: 'Money added to bank successfully',
            data: bank,
        });
    } catch (error) {
        console.log('Error adding money to bank:', error);
        return res.status(500).json({
            success: false,
            message: 'Error adding money to bank',
            error: error.message,
        });
    }
};




// Fetch the bank details for a specific staff membe

exports.chooseBank = async (req, res) => {

    const { username, bankId } = req.body;

    try {
        // Find the bank by ID and check its availability
        const bank = await Bank.findById(bankId);
        if (!bank || !bank.availability) {
            return res.status(400).json({
                success: false,
                message: 'Bank is unavailable'
            });
        }

        // Find the staff by username
        const staff = await Allstaff.findOne({ username });
        if (!staff) {
            return res.status(400).json({
                success: false,
                message: 'Staff not found'
            });
        }

        // Check if 24 hours have passed since the last bank choice
        if (staff.lastBankChoice) {
            const lastChoiceTime = new Date(staff.lastBankChoice);
            const currentTime = new Date();
            const timeDiff = currentTime - lastChoiceTime;  // Difference in milliseconds

            if (timeDiff < 24 * 60 * 60 * 1000) {  // 24 hours in milliseconds
                return res.status(400).json({
                    success: false,
                    message: 'You can only choose a bank once every 24 hours.'
                });
            }
        }

        // Add the bank to the staff's banks array with the opening balance
        const bankIndex = staff.banks.findIndex(b => b._id.toString() === bankId);

        if (bankIndex === -1) {
            // If the bank is not already in the array, add it
            staff.banks.push({
                _id: bank._id,
                bankName: bank.bankName,
                bankAccountName: bank.bankAccountName,
                bankAccountNumber: bank.bankAccountNumber,
                availability: bank.availability,
                status: 'in use',
                amount: bank.amount,
                openingBalance: bank.amount,  // Store the opening balance
            });
        } else {
            // If the bank already exists in the staff's array, update its status and opening balance
            staff.banks[bankIndex].status = 'in use';
            staff.banks[bankIndex].openingBalance = bank.amount; // Update opening balance
        }

        // Update the last bank choice timestamp
        staff.lastBankChoice = new Date();  // Set the current time as the last bank choice time

        // Save the updated staff document
        await staff.save();

        // Mark the bank as "in use" in the Bank collection
        bank.status = 'in use';
        await bank.save();  // Save the updated bank

        return res.status(200).json({
            success: true,
            message: 'Bank chosen successfully for staff use',
            data: { bankId, username, openingBalance: bank.amount }
        });
    } catch (error) {
        console.log('Error choosing bank:', error);
        return res.status(500).json({
            success: false,
            message: 'Error processing request',
            error: error.message
        });
    }
};





exports.getStaffBankInfo = async (req, res) => {
    const { username } = req.params; // Get the username from the URL parameter

    try {
        // Find the staff member by username
        const staff = await Allstaff.findOne({ username });
        if (!staff) {
            return res.status(400).json({
                success: false,
                message: 'Staff not found'
            });
        }

        // Check if staff has any banks
        if (staff.banks.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No banks found for the selected staff'
            });
        }

        // Assuming you want to return the first bank from the `banks` array
        const bank = staff.banks[0]; // You can customize this to find a specific bank

        // Return the bank details
        return res.status(200).json({
            success: true,
            message: 'Staff bank details retrieved successfully',
            data: {
                bankName: bank.bankName,
                bankAccountNumber: bank.bankAccountNumber,
                bankAccountName:bank.bankAccountName,
                balance: bank.amount 
            }
        });
    } catch (error) {
        console.log('Error fetching staff bank info:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching staff bank info',
            error: error.message
        });
    }
};



// Record a debit as an inflow for the staff
exports.recordInflow = async (req, res) => {
    const { username, amount } = req.body;

    try {
        // Find the staff by username
        const staff = await Allstaff.findOne({ username });
        if (!staff) {
            return res.status(400).json({
                success: false,
                message: 'Staff not found'
            });
        }

        // Find an available bank that is "in use"
        const availableBank = staff.banks.find(bank => bank.status === 'in use');
        if (!availableBank) {
            return res.status(400).json({
                success: false,
                message: 'No available bank in use'
            });
        }

        // Deduct amount from the selected bank
        availableBank.amount -= amount;

        // Ensure the bank's amount does not drop below -10,000
        if (availableBank.amount < -10000) {
            availableBank.amount = -10000;
        }

        // Update bank availability in the user's bank if the amount is <= 0, but keep it 'in use' if necessary
        if (availableBank.amount <= 0 && availableBank.status !== 'in use') {
            availableBank.availability = false;
        }

        // Update the standalone Bank collection with the new amount and availability
        await Bank.findByIdAndUpdate(availableBank._id, {
            amount: availableBank.amount,
            availability: availableBank.availability,
            status: availableBank.status
        });

        // Update the staff's bank object with the latest values (including the negative balance if any)
        await Allstaff.updateOne(
            { _id: staff._id, 'banks._id': availableBank._id },
            { 
                $set: { 
                    'banks.$.amount': availableBank.amount, 
                    'banks.$.availability': availableBank.availability,
                    'banks.$.status': availableBank.status
                }
            }
        );

        // Record inflow for staff
        const inflow = new Inflow({
            staff: staff._id,
            bank: availableBank._id,
            amount
        });
        await inflow.save();

        // Populate the inflow with staff and bank details
        const populatedInflow = await Inflow.findById(inflow._id)
            .populate('staff', 'name')
            .populate('bank', 'bankName');

        return res.status(200).json({
            success: true,
            message: 'Inflow recorded successfully for staff',
            data: populatedInflow
        });
    } catch (error) {
        console.log('Error recording inflow:', error);
        return res.status(500).json({
            success: false,
            message: 'Error processing inflow',
            error: error.message
        });
    }
};




// Get all banks
exports.getAllBanks = async (req, res) => {
    try {
        const banks = await Bank.find();
        return res.status(200).json({
            success: true,
            message: 'Banks retrieved successfully',
            data: banks
        });
    } catch (error) {
        console.log('Error fetching banks:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching banks',
            error: error.message
        });
    }
};

// Get inflows for a particular staff

exports.getInflowsForStaff = async (req, res) => {
    const { username } = req.params;  // Use username directly

    try {
        // Find the staff by username
        const staff = await Allstaff.findOne({ username });
        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Staff not found'
            });
        }

        const inflows = await Inflow.find({ 'staff.username': username })
            .populate('bank', 'bankName') 
            .populate('staff', 'username');    

        if (inflows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No inflows found for this staff member'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Inflows retrieved successfully for staff',
            data: inflows
        });
    } catch (error) {
        console.log('Error fetching inflows:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching inflows for staff',
            error: error.message
        });
    }
};


exports.resolveTradeComplaint = async (req, res) => {

    const { tradeId } = req.body;
    
    try {
        // Step 1: Fetch the trade from the complaints collection
        const complaintSnapshot = await db.collection('complaints').doc(tradeId).get();

        if (!complaintSnapshot.exists) {
            return responseController.errorResponse(res, 'Trade complaint not found', null, 404);
        }

        const complaintData = complaintSnapshot.data();
        const { trade_hash, fiat_amount_requested, buyer_name } = complaintData;

        // Step 2: Find the staff who had this trade
        const staffSnapshot = await db.collection('Allstaff').get();
        let staffWithTrade;

        staffSnapshot.docs.forEach(doc => {
            const staffData = doc.data();
            const hasTrade = staffData.assignedTrades.some(trade => trade.trade_hash === trade_hash);

            if (hasTrade) {
                staffWithTrade = doc;
            }
        });

        if (!staffWithTrade) {
            return responseController.errorResponse(res, 'No staff found with the given trade hash', null, 404);
        }

        const assignedAt = new Date();
        const staffRef = db.collection('Allstaff').doc(staffWithTrade.id);
        
        // Step 3: Update the assigned trade in Firestore
        const staffData = staffWithTrade.data();
        const existingTrade = staffData.assignedTrades.find(trade => trade.trade_hash === trade_hash);

        // Only update the trade if it already exists, no need to add it again
        if (existingTrade) {
            await staffRef.update({
                assignedTrades: admin.firestore.FieldValue.arrayRemove(existingTrade),
            });
            
            existingTrade.isPaid = false;
            existingTrade.assignedAt = assignedAt;
            existingTrade.markedAt = null; // Remove markedAt

            await staffRef.update({
                assignedTrades: admin.firestore.FieldValue.arrayUnion(existingTrade),
            });
        }

        // Step 4: Update the assigned trade in MongoDB using Mongoose
        const updatedStaff = await Allstaff.findOneAndUpdate(
            { 'assignedTrades.trade_hash': trade_hash },
            {
                $set: {
                    'assignedTrades.$.isPaid': false, // Set isPaid to false
                    'assignedTrades.$.markedAt': null, // Remove markedAt field
                    'assignedTrades.$.assignedAt': assignedAt, // Update assignedAt timestamp
                    'assignedTrades.$.handle': buyer_name // Update handle if necessary
                }
            },
            { new: true } // Return the updated document
        );

        if (!updatedStaff) {
            return responseController.errorResponse(res, 'Trade not found in assignedTrades in MongoDB', null, 404);
        }

        // Step 5: Update the trade in the complaints collection
        await db.collection('complaints').doc(tradeId).update({
            markedAt: admin.firestore.FieldValue.delete(), // Remove the markedAt field
            isPaid: false, // Set isPaid to false
        });

        // Return success response after all updates
        console.log(`Trade ${trade_hash} successfully resolved and reassigned to the original staff.`);
        return responseController.successResponse(res, 'Trade complaint resolved and reassigned successfully', { trade_hash }, 200);
    } catch (error) {
        console.error('Error resolving trade complaint:', error);
        return responseController.errorResponse(res, 'Error resolving trade complaint', error.message, 500);
    }
};



cron.schedule('20 10 * * *', async () => {
    try {
        // Step 1: Reset all banks' amounts and set status to 'unavailable'
        await Bank.updateMany(
            {},
            {
                $set: {
                    amount: 0,
                    status: 'unavailable',
                    availability: false,
                    updatedAt: Date.now()
                }
            }
        );

        // Step 2: Update staff records to reset bank information
        await Allstaff.updateMany(
            { 'banks.status': { $exists: true } }, // Only update if a staff member has banks
            { 
                $set: {
                    'banks.$[bank].amount': 0, 
                    'banks.$[bank].status': 'unavailable', 
                    'banks.$[bank].availability': false,
                },
                $unset: { lastBankChoice: "", currentBankId: "" } // Clear lastBankChoice and currentBankId fields
            },
            { arrayFilters: [{ 'bank.status': { $exists: true } }] } // Apply to all banks in the array
        );

        // Step 3: Remove any banks with 'unavailable' status from staff members' `banks` array
        await Allstaff.updateMany(
            {},
            { $pull: { banks: { status: 'unavailable' } } } // Remove banks with status 'unavailable'
        );

        console.log('Banks have been reset, staff bank records updated, last bank choices cleared, and unavailable banks removed.');
    } catch (error) {
        console.log('Error updating bank records and staff records:', error);
    }
});





  
  