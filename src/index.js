const express = require('express');
const bodyParser = require('body-parser');
const webhookRoutes = require('./routes/webhook');
const authRoutes = require('./routes/auth');
const OpenBanking = require('./routes/openbanking');
const manualRoutes = require('./routes/manualtrade');
const hrRoutes = require('./routes/Hr');
const rateRoutes = require('./routes/rates');
const Staffs = require('./routes/staffs')
const mongoose = require("mongoose");
const dotenv = require("dotenv").config();
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

// ----- CORS FIX -----
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false  // Change this to false when using origin: '*'
}));

// Handle preflight
app.options('*', cors());
// ------------------------------------------

// Raw body capture
app.use(function(req, res, next) {
    req.rawBody = '';
    req.on('data', function(chunk) {
        req.rawBody += chunk;
    });
    next();
});

app.use(bodyParser.json());

// Use the routes
app.use(webhookRoutes);
app.use(authRoutes);
app.use(OpenBanking);
app.use(Staffs);
app.use(manualRoutes);
app.use(hrRoutes);
app.use(rateRoutes);

app.listen(port, async () => {
    console.log("RUNNING_LOCALS >>>", port);

    try {
        const conn = await mongoose.connect(process.env.DB_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            ignoreUndefined: true,
        });
        console.log("DB CONNECTED >>>>");
    } catch (error) {
        console.error("Error connecting to database:", error);
    }
});
