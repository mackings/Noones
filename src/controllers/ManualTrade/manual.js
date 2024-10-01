const admin = require("firebase-admin");
const axios = require("axios");
const mongoose = require('mongoose');
const db = admin.firestore();
const serviceAccount = require("../Utils/firebaseservice");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


