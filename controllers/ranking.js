var ss = require('simple-statistics');
var { db, admin } = require('../models/firebase');

async function getRanking(uid, userData, scope) {
    const usersRef = db.collection('users');
    
    let usersSnapshot;

    if (scope === 'local') {
        usersSnapshot = await usersRef.where('school', '==', userData.school).orderBy('points', 'desc').limit(5).get();
    }  else {
        usersSnapshot = await usersRef.orderBy('points', 'desc').limit(5).get();
    }

    const pts = userData.points;

    const users = [];
    let userContained = false;
    let ranking = 1;
    let officialRanking = 1;
    const points = [];

    usersSnapshot.forEach(doc => {
        const data = doc.data();
        users.push({ data: { points: data.points, streak: data.streak, firstName: data.firstName, lastName: data.lastName, school: data.school } });

        points.push([parseInt(data.points), Math.log(ranking)]);

        if (uid === doc.id) {
            userContained = true;
            officialRanking = ranking;
        }

        ranking += 1;

        // curves the asymptote up
        points.push([0, Math.log(10000)]);
    });

    if (userData.points === 0) {
        return { users, ranking: (scope === 'global') ? userData.prevGlobalRanking : userData.prevLocalRanking, school: userData.school, prevRanking: (scope === 'global') ? userData.prevGlobalRanking : userData.prevLocalRanking };
    }

    if (!userContained) {
        // use linear regression to build exponential model to predict ranking
        const line = ss.linearRegression(points);
        const A = Math.E ** line.b;
        const B = line.m;
        ranking = Math.ceil((A * Math.E ** (B * pts)))
    } else {
        ranking = officialRanking;
    }

    return { users, ranking, school: userData.school, prevRanking: (scope === 'global') ? userData.prevGlobalRanking : userData.prevLocalRanking };
}

module.exports = { getRanking };