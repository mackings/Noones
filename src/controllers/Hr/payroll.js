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
        const month = currentDate.toLocaleString('default', { month: 'long' });
        const year = currentDate.getFullYear();

        // Calculate payroll amount based on days of work and other parameters
        const payrollEntry = {
            date: currentDate,
            amount: basicSalary + pay + incentives - (debt + penalties + deductions), // Adjust this formula based on your logic
            month,
            year,
            level,
            name,
            basicSalary,
            daysOfWork,
            pay,
            incentives,
            debt,
            penalties,
            payables,
            savings,
            deductions,
            netSalary
        };

        // Check for existing payroll in the same month and year and remove if found
        const existingPayrollIndex = staff.payroll.findIndex(
            (entry) => entry.month === month && entry.year === year
        );

        if (existingPayrollIndex !== -1) {
            staff.payroll.splice(existingPayrollIndex, 1); // Remove the previous payroll for the current month
        }

        // Add the new payroll entry
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


