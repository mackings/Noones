const express = require("express");
const responseController = require("../Utils/responses");
const Allstaff = require("../Model/staffmodel");


exports.createPayroll = async (req, res) => {
    try {
        const { username, date, amount, month, year, level, basicSalary, pay, incentives, debt, penalties, payables, savings, deductions, netSalary } = req.body;

        const staff = await Allstaff.findOne({ username });
        if (!staff) {
            return responseController.errorResponse(res, 'Staff not found', null, 404);
        }

        // Create a new payroll entry
        const payrollEntry = {
            date,
            amount,
            month,
            year,
            level,
            basicSalary,
            pay,
            incentives,
            debt,
            penalties,
            payables,
            savings,
            deductions,
            netSalary
        };

        // Add payroll entry to staff's payroll array
        staff.payroll.push(payrollEntry);

        // Save the staff document with the updated payroll
        await staff.save();

        return responseController.successResponse(res, 'Payroll created successfully', staff.payroll);
    } catch (error) {
        return responseController.errorResponse(res, 'Error creating payroll', error);
    }
};



exports.getAllStaffPayrolls = async (req, res) => {
    try {
        // Fetch all staff documents from the database, including only their payroll data and username
        const staffPayrolls = await Allstaff.find({}, 'username payroll');

        // Check if there are any staff records
        if (!staffPayrolls || staffPayrolls.length === 0) {
            return responseController.errorResponse(res, 'No staff payroll records found', null, 404);
        }

        // Return the payroll data for all staff
        return responseController.successResponse(res, 'Staff payrolls retrieved successfully', staffPayrolls);
    } catch (error) {
        return responseController.errorResponse(res, 'Error retrieving staff payrolls', error);
    }
};
