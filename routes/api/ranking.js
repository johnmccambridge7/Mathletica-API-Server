var express = require('express');
var router = express.Router();
var { db, admin } = require('../../models/firebase');
var { getRanking } = require('../../controllers/ranking');

router.post('/getLeaderboard', async function(req, res){
    const uid = req.body.uid;

    // based on the scope, fetch the leaderboard
    const usersRef = db.collection('users');
    const user = await usersRef.doc(uid).get();
    const userData = user.data();

    // fetch the top 5 people and union with the uid position
    let globalRanking = await getRanking(uid, userData, 'global');
    let localRanking = await getRanking(uid, userData, 'local');

    res.json({ success: true, msg: { 
        prevGlobalRanking: globalRanking.prevRanking,
        prevLocalRanking: localRanking.prevRanking,
        school: localRanking.school,
        users: globalRanking.users,
        ranking: globalRanking.ranking,
        localRanking: localRanking.ranking,
        localUsers: localRanking.users
    }});
});

module.exports = router;