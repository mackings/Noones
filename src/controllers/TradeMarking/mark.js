const admin = require('firebase-admin');
const express = require('express');
const Allstaff = require("../Model/staffmodel");


// exports.markTradeAsPaid = async (req, res) => {
//   const { markedAt, trade_hash, name, amountPaid } = req.body;

//   try {
//     // Fetch all staff data from Firestore
//     const staffSnapshot = await admin.firestore().collection('Allstaff').get();
//     let staffToUpdate;

//     // Loop through all staff documents to find the trade in Firestore
//     staffSnapshot.docs.forEach(doc => {
//       const staffData = doc.data();
//       const tradeIndex = staffData.assignedTrades.findIndex(trade => trade.trade_hash === trade_hash);

//       if (tradeIndex !== -1) {
//         staffToUpdate = {
//           docId: doc.id,
//           tradeIndex
//         };
//       }
//     });

//     if (!staffToUpdate) {
//       return res.status(404).json({ status: 'error', message: 'Trade not found.' });
//     }

//     // Update in Firestore
//     const staffRef = admin.firestore().collection('Allstaff').doc(staffToUpdate.docId);
//     const staffDoc = await staffRef.get();
//     const assignedTrades = staffDoc.data().assignedTrades;
//     const tradeToUpdate = assignedTrades[staffToUpdate.tradeIndex];
//     tradeToUpdate.isPaid = true;
//     tradeToUpdate.markedAt = markedAt;

//     if (name) {
//       tradeToUpdate.name = name;
//     }

//     if (amountPaid) {
//       tradeToUpdate.amountPaid = amountPaid;
//     }

//     // Save the updated assignedTrades array back to Firestore
//     await staffRef.update({ assignedTrades });

//     // Now update in MongoDB
//     const staffInMongo = await Allstaff.findOne({ 'assignedTrades.trade_hash': trade_hash });

//     if (staffInMongo) {
//       const tradeIndexMongo = staffInMongo.assignedTrades.findIndex(trade => trade.trade_hash === trade_hash);

//       if (tradeIndexMongo !== -1) {
//         staffInMongo.assignedTrades[tradeIndexMongo].isPaid = true;
//         staffInMongo.assignedTrades[tradeIndexMongo].markedAt = markedAt;

//         if (name) {
//           staffInMongo.assignedTrades[tradeIndexMongo].name = name;
//         }

//         if (amountPaid) {
//           staffInMongo.assignedTrades[tradeIndexMongo].amountPaid = amountPaid;
//         }

//         // Save the updated staff document in MongoDB
//         await staffInMongo.save();
//       } else {
//         return res.status(404).json({ status: 'error', message: 'Trade not found in MongoDB.' });
//       }
//     } else {
//       return res.status(404).json({ status: 'error', message: 'Staff not found in MongoDB.' });
//     }

//     // If both updates were successful, send a success response
//     res.json({
//       status: 'success',
//       message: `Trade marked as paid successfully with markedAt time: ${markedAt}.`
//     });
//   } catch (error) {
//     console.error('Error marking trade as paid:', error);
//     res.status(500).json({ status: 'error', message: 'Failed to mark trade as paid.', error });
//   }
// };


exports.markTradeAsPaid = async (req, res) => {
  const { markedAt, trade_hash, name, amountPaid } = req.body;

  try {
    // Fetch all staff data from Firestore
    const staffSnapshot = await admin.firestore().collection('Allstaff').get();
    let staffToUpdate;

    // Loop through all staff documents to find the trade in Firestore
    staffSnapshot.docs.forEach(doc => {
      const staffData = doc.data();
      const tradeIndex = staffData.assignedTrades.findIndex(trade => trade.trade_hash === trade_hash);

      if (tradeIndex !== -1) {
        staffToUpdate = {
          docId: doc.id,
          tradeIndex,
          username: staffData.username // Capture username here to match with MongoDB
        };
      }
    });

    if (!staffToUpdate) {
      return res.status(404).json({ status: 'error', message: 'Trade not found in Firestore.' });
    }

    // Update in Firestore
    const staffRef = admin.firestore().collection('Allstaff').doc(staffToUpdate.docId);
    const staffDoc = await staffRef.get();
    const assignedTrades = staffDoc.data().assignedTrades;
    const tradeToUpdate = assignedTrades[staffToUpdate.tradeIndex];
    tradeToUpdate.isPaid = true;
    tradeToUpdate.markedAt = markedAt;

    if (name) {
      tradeToUpdate.name = name;
    }

    if (amountPaid) {
      tradeToUpdate.amountPaid = amountPaid;
    }

    // Save the updated assignedTrades array back to Firestore
    await staffRef.update({ assignedTrades });

    // Log for debugging MongoDB query
    console.log('Searching for staff in MongoDB with username:', staffToUpdate.username);
    console.log('Searching for trade with hash:', trade_hash);

    // Now update in MongoDB
    const staffInMongo = await Allstaff.findOne({ username: staffToUpdate.username, 'assignedTrades.trade_hash': trade_hash });

    if (staffInMongo) {
      const tradeIndexMongo = staffInMongo.assignedTrades.findIndex(trade => trade.trade_hash === trade_hash);

      if (tradeIndexMongo !== -1) {
        staffInMongo.assignedTrades[tradeIndexMongo].isPaid = true;
        staffInMongo.assignedTrades[tradeIndexMongo].markedAt = markedAt;

        if (name) {
          staffInMongo.assignedTrades[tradeIndexMongo].name = name;
        }

        if (amountPaid) {
          staffInMongo.assignedTrades[tradeIndexMongo].amountPaid = amountPaid;
        }

        // Save the updated staff document in MongoDB
        await staffInMongo.save();
      } else {
        return res.status(404).json({ status: 'error', message: 'Trade not found in MongoDB.' });
      }
    } else {
      return res.status(404).json({ status: 'error', message: 'Staff not found in MongoDB.' });
    }

    // If both updates were successful, send a success response
    res.json({
      status: 'success',
      message: `Trade marked as paid successfully with markedAt time: ${markedAt}.`
    });
  } catch (error) {
    console.error('Error marking trade as paid:', error);
    res.status(500).json({ status: 'error', message: 'Failed to mark trade as paid.', error });
  }
};

