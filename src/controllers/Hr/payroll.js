const express = require("express");
const responseController = require("../Utils/responses");
const Allstaff = require("../Model/staffmodel");


exports.createPayroll = async (req, res) => {

    try {
        const { name, level, basicSalary, daysOfWork, pay, incentives, debt, penalties, payables, savings, deductions, netSalary } = req.body;

        const staff = await Allstaff.findOne({ name });
        if (!staff) {
            return responseController.errorResponse(res, 'Staff not found', null, 404);
        }

        const currentDate = new Date();
        const date = currentDate;
        const month = currentDate.toLocaleString('default', { month: 'long' });
        const year = currentDate.getFullYear();

        // Calculate amount based on days of work and other parameters
        const payrollEntry = {
            date,
            amount: basicSalary + pay + incentives - (debt + penalties + deductions), // Adjust this formula based on your logic
            month,
            year,
            level,
            name,
            basicSalary,
            daysOfWork, // Include daysOfWork here
            pay,
            incentives,
            debt,
            penalties,
            payables,
            savings,
            deductions,
            netSalary
        };

        staff.payroll.push(payrollEntry);

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

        const staffCount = staffPayrolls.length;
        let totalAmountPaid = 0;
        let totalDebts = 0;

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
            staffPayrolls  // This will now include the daysOfWork and other fields.
        });
    } catch (error) {
        return responseController.errorResponse(res, 'Error retrieving staff payrolls', error);
    }
};


