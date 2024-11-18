const mongoose = require('mongoose');

const manualUnassignedSchema = new mongoose.Schema({
    account: { type: String, required: true },
    analytics: { type: Object, required: true },
    isPaid: { type: Boolean, default: false },
    assignedAt: { type: Date, default: Date.now },
    trade_hash: { type: String, required: true },
    seller_name: { type: String, required: true },
    handle: { type: String, required: true },
    fiat_amount_requested: { type: Number, required: true }
});

const ManualUnassigned = mongoose.models.ManualUnassigned || mongoose.model('ManualUnassigned', manualUnassignedSchema);

module.exports = ManualUnassigned;
