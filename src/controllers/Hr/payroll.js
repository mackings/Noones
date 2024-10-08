const express = require("express");
const responseController = require("../Utils/responses");
const Allstaff = require("../Model/staffmodel");


exports.createPayroll = async (req, res) => {

    try {
        const { name, level, basicSalary, pay, incentives, debt, penalties, payables, savings, deductions, netSalary } = req.body;

        const staff = await Allstaff.findOne({ name });
        if (!staff) {
            return responseController.errorResponse(res, 'Staff not found', null, 404);
        }

        // Get the current date, month, and year
        const currentDate = new Date();
        const date = currentDate; // Full current date
        const month = currentDate.toLocaleString('default', { month: 'long' }); // Current month as a string (e.g., 'October')
        const year = currentDate.getFullYear(); // Current year (e.g., 2024)

        // Create a new payroll entry
        const payrollEntry = {
            date,
            amount: basicSalary + pay + incentives - (debt + penalties + deductions), // Calculate total amount
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
        const staffPayrolls = await Allstaff.find({}, 'name payroll');

        if (!staffPayrolls || staffPayrolls.length === 0) {
            return responseController.errorResponse(res, 'No staff payroll records found', null, 404);
        }

        // Calculate total staff count
        const staffCount = staffPayrolls.length;

        // Initialize totals
        let totalAmountPaid = 0;
        let totalDebts = 0;

        // Iterate through payrolls and calculate totals
        staffPayrolls.forEach(staff => {
            staff.payroll.forEach(payrollEntry => {
                totalAmountPaid += payrollEntry.pay || 0;
                totalDebts += payrollEntry.debt || 0;
            });
        });

        return responseController.successResponse(res, 'Staff payrolls retrieved successfully', {
            staffCount,
            totalAmountPaid,
            totalDebts,
            staffPayrolls // returning the payroll details of each staff
        });
    } catch (error) {
        return responseController.errorResponse(res, 'Error retrieving staff payrolls', error);
    }
};

