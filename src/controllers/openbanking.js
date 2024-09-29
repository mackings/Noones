const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv').config();
const router = express.Router();


exports.handleRequest = async (req, res) => {
    try {
      // Destructure the transfer data from the request body
      const { BeneficiaryAccount, beneficiaryBankCode, amount, ClientAccountNumber, beneficiaryName, NameEnquirySessionID, narration, ClientFeeCharge, SenderName } = req.body;
  
      // Fetch the API URL from environment variables
      const apiUrl = process.env.KUDA_API_URL;
  
      // Step 1: Get the token (calling the GetToken API)
      const tokenResponse = await axios.post(`${apiUrl}/Account/GetToken`, {
        email: process.env.KUDA_API_EMAIL,
        apiKey: process.env.KUDA_API_KEY,
      });
  
      const token = tokenResponse.data; // Extract token from the response
      console.log(token); 
  
      // Step 2: Make the fund transfer using the token
      const transferResponse = await axios.post(
        `${apiUrl}`, // Use the API URL from environment variables
        {
          serviceType: "SINGLE_FUND_TRANSFER", // Set the serviceType
          requestRef: `${Math.floor(Math.random() * 100000)}-Noll`, // Generate request reference
          Data: {
            BeneficiaryAccount,
            beneficiaryBankCode,
            amount,
            beneficiaryName,
            narration,
            SenderName
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`, // Pass the token in Authorization header
            'Content-Type': 'application/json',
          },
        }
      );
  
      // Return the result of the transfer to the client
      res.status(200).json(transferResponse.data);
      
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred during the transfer process' });
    }
  };



  exports.retrieveTransactionLogs = async (req, res) => {
    try {
        // Destructure data from the request body
        const { RequestReference, ResponseReference, TransactionDate, StartDate, EndDate, PageSize, PageNumber } = req.body;

        // Fetch the API URL from environment variables
        const apiUrl = process.env.KUDA_API_URL;

        // Step 1: Get the token (calling the GetToken API)
        const tokenResponse = await axios.post(`${apiUrl}/Account/GetToken`, {
            email: process.env.KUDA_API_EMAIL,
            apiKey: process.env.KUDA_API_KEY,
        });

        const token = tokenResponse.data; // Extract token from the response
        console.log(token);

        // Step 2: Retrieve transaction logs using the token
        const logsResponse = await axios.post(
            `${apiUrl}`, // Use the appropriate endpoint
            {
                serviceType: "RETRIEVE_TRANSACTION_LOGS", // Set the service type
                requestRef: `${Math.floor(Math.random() * 100000)}-Noll`, // Generate request reference
                Data: {
                    RequestReference,
                    ResponseReference,
                    TransactionDate,
                    StartDate,
                    EndDate,
                    PageSize,
                    PageNumber
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`, // Pass the token in Authorization header
                    'Content-Type': 'application/json',
                },
            }
        );

        // Return the result of the transaction logs to the client
        res.status(200).json(logsResponse.data);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while retrieving transaction logs' });
    }
};

