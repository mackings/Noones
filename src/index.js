const express = require('express');
const bodyParser = require('body-parser');
const webhookRoutes = require('./routes/webhook');
const authRoutes = require('./routes/auth');
const OpenBanking = require('./routes/openbanking');
const Staffs = require('./routes/staffs')
const mongoose = require("mongoose");
const dotenv = require("dotenv").config();

const app = express();
const port = 3000;

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


app.listen(port,async () => {
    
    console.log("RUNNING_LOCALS >>>", process.env.PORT || 3000);
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
