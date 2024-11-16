const mongoose = require('mongoose');

// Define the schema for selling price
const sellingPriceSchema = new mongoose.Schema({
    price: {
        type: Number,
        required: [true, 'Price is required'], // Validation: Price is mandatory
        min: [0, 'Price must be greater than or equal to 0'], // Validation: Minimum value
    },
    createdAt: {
        type: Date,
        default: Date.now, // Automatically set the creation date
    },
});

// Export the model
module.exports = mongoose.model('SellingPrice', sellingPriceSchema);