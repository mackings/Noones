const express = require('express');
const bodyParser = require('body-parser');
const webhookRoutes = require('./routes/webhook');
const authRoutes = require('./routes/auth');
const OpenBanking = require('./routes/openbanking');

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

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
