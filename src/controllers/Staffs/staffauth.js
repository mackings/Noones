
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv').config();
const Staff = require("../Model/staffmodel");
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const responseController = require("../Utils/responses");
const admin = require("firebase-admin");
const db = admin.firestore();
const serviceAccount = require("../Utils/firebaseservice");
const Allstaff = require("../Model/staffmodel");
const Trade = require("../Model/staffmodel");



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
        const existingStaff = await Staff.findOne({ username });
        if (existingStaff) {
            return responseController.errorResponse(res, 'Staff already exists', null, 400);
        }

        // Hash the password and create the staff member in MongoDB
        const hashedPassword = await bcrypt.hash(password, 10);
        const newStaff = new Staff({
            username,
            password: hashedPassword,
            name,
            email,
            role, // Use the role from request body
            assignedTrades: [], // Initialize assignedTrades
            paidTrades: [], // Initialize paidTrades if applicable
            clockedIn: false, // Initialize clockedIn status
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
        const staff = await Staff.findOne({ username });
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
        const staff = await Staff.findById(decoded.id);

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
        const staff = await Staff.findById(decoded.id);

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
        const staff = await Staff.findOne({ name });

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
        };

        // Return the staff data
        return responseController.successResponse(res, 'Staff member data retrieved successfully', staffData);
    } catch (error) {
        return responseController.errorResponse(res, 'Error fetching staff data', error);
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



  
  