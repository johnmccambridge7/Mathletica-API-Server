var admin = require("firebase-admin");
var firebase = require("firebase/app");
var serviceAccount = require("../service.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://mathletica-9a3d0.firebaseio.com"
});

firebase.initializeApp({
    apiKey: "AIzaSyAY1OeuDvi_sTsSM-p6TAk2qxHuGWZxNLc",
    authDomain: "mathletica-9a3d0.firebaseapp.com",
    databaseURL: "https://mathletica-9a3d0.firebaseio.com",
    projectId: "mathletica-9a3d0",
    storageBucket: "mathletica-9a3d0.appspot.com",
    messagingSenderId: "575769181168",
    appId: "1:575769181168:web:3cf0aa57cad8361635fb35",
    measurementId: "G-KQDC53F0B6"
});

require("firebase/auth");

const db = admin.firestore();

module.exports = { db, admin, firebase };