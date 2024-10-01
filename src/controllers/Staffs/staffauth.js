// Required dependencies
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv').config();
const Staff = require("../Model/staffs");
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const responseController = require("../Utils/responses");


// Register staff

exports.registerStaff = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if the staff already exists
        const existingStaff = await Staff.findOne({ username });
        if (existingStaff) {
            return responseController.errorResponse(res, 'Staff already exists', null, 400);
        }

        // Hash the password and create the staff member
        const hashedPassword = await bcrypt.hash(password, 10);
        const newStaff = new Staff({ username, password: hashedPassword });
        await newStaff.save();

        return responseController.successResponse(res, 'Staff registered successfully', newStaff, 201);
    } catch (error) {
        return responseController.errorResponse(res, 'Error registering staff', error);
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
