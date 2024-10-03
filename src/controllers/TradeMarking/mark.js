const admin = require('firebase-admin');
const express = require('express');



exports.markTradeAsPaid = async (req, res) => {
    
  const { markedAt, trade_hash, name, amountPaid } = req.body;

  try {
    // Fetch all staff data
    const staffSnapshot = await admin.firestore().collection('Allstaff').get();
    let staffToUpdate;

    // Loop through all staff documents to find the trade
    staffSnapshot.docs.forEach(doc => {
      const staffData = doc.data();
      const tradeIndex = staffData.assignedTrades.findIndex(trade => trade.trade_hash === trade_hash);

      if (tradeIndex !== -1) {
        staffToUpdate = {
          docId: doc.id,
          tradeIndex
        };
      }
    });

    if (!staffToUpdate) {
      return res.status(404).json({ status: 'error', message: 'Trade not found.' });
    }

    // Reference the staff document for update
    const staffRef = admin.firestore().collection('Allstaff').doc(staffToUpdate.docId);
    const staffDoc = await staffRef.get();
    const assignedTrades = staffDoc.data().assignedTrades;

    // Get the specific trade to update
    const tradeToUpdate = assignedTrades[staffToUpdate.tradeIndex];

    // Mark the trade as paid and update markedAt
    tradeToUpdate.isPaid = true;
    tradeToUpdate.markedAt = markedAt;

    // Update name and amountPaid if provided
    if (name) {
      tradeToUpdate.name = name; // Update name even if it exists
    }

    if (amountPaid) {
      tradeToUpdate.amountPaid = amountPaid; // Update amountPaid even if it exists
    }

    // Save the updated assignedTrades array back to Firestore
    await staffRef.update({ assignedTrades });

    res.json({
      status: 'success',
      message: `Trade marked as paid successfully with markedAt time: ${markedAt}.`
    });
  } catch (error) {
    console.error('Error marking trade as paid:', error);
    res.status(500).json({ status: 'error', message: 'Failed to mark trade as paid.', error });
  }
};
