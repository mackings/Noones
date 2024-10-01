
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv').config();
const Staff = require("../Model/staffs");
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const responseController = require("../Utils/responses");
const admin = require("firebase-admin");
const db = admin.firestore();
const serviceAccount = require("../Utils/firebaseservice");


const addNewStaff = async (staffId, staffDetails) => {
    try {
        const staffRef = db.collection('Allstaff').doc(staffId);

        await staffRef.set({
            ...staffDetails,
            assignedTrades: [],
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Staff ${staffId} added to Firestore and ready to receive trades.`);
    } catch (error) {
        console.error('Error adding new staff to Firestore:', error);
        throw new Error('FirestoreError'); // Throw an error if Firestore addition fails
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
        const newStaff = new Staff({ username, password: hashedPassword, name, email, role });
        await newStaff.save(); // Save to MongoDB

        // Add the staff to Firestore
        const staffDetailsForFirestore = {
            name,
            email,
            role,
            username
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

        return responseController.successResponse(res, 'Login successful', { token });
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

        return responseController.successResponse(res, 'Clocked out successfully', { clockOutTime });
    } catch (error) {
        return responseController.errorResponse(res, 'Error clocking out', error);
    }
};
