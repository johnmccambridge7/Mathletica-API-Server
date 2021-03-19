var express = require('express');
var router = express.Router();
var { db, firebase, admin } = require('../../models/firebase');

router.post('/register', function (req, res) {
    const email = req.body.email;
    const password = req.body.password;
    const firstName = req.body.firstName;
    const lastName = req.body.lastName;
    const school = req.body.school;

    firebase.auth().createUserWithEmailAndPassword(email, password).then((user) => {
        const usersRef = db.collection('users');

        usersRef.doc(user.user.uid).set({
            email,
            firstName,
            lastName,
            school,
            points: 0,
            prevLocalRanking: 10000,
            prevGlobalRanking: 10000,
            tutorial: false,
            performance: {
                Circles: 0,
                Differentiation: 0,
                'Equation of Line': 0,
                Exponentials: 0,
                'Functions & Graphs': 0,
                Integration: 0,
                Logarithm: 0,
                'Polynomials & Quadratics': 0,
                'Recurrence Relations': 0,
                'Trig Formulae & Equations': 0,
                Vectors: 0
            }
        }).then((docRef) => {
            res.json({ success: true, msg: user });
        }).catch((e) => {
            console.log(e);
            res.json({ success: false });
        });
    }).catch((e) => {
        res.json({ success: false, msg: 'Something went wrong.' });
    });
});

router.post('/livestream', async function (req, res) {
    const currentTimestamp = new Date().getTime();
    const uid = req.body.question.uid;
    const question = { ...req.body.question, time: currentTimestamp };
    const ref = db.collection('livestream');

    const questionSnapshot = await ref.where('uid', '==', uid).orderBy('time', 'desc').limit(1).get();

    if (questionSnapshot.size > 0) {
        questionSnapshot.forEach(doc => {
            const data = doc.data();
            const previousTimestamp = data.time;
            const delta = currentTimestamp - previousTimestamp;

            if (delta > 10000) {
                ref.add(question).then((docRef) => res.json({ success: true }) ).catch((e) => res.json({ success: false }) );
            } else {
                res.json({ success: false });
            }
        });
    } else {
        console.log('Adding new question', uid);
        ref.add(question).then((docRef) => res.json({ success: true }) ).catch((e) => res.json({ success: false }) );
    }
});

router.post('/completeTutorial', async function(req, res) {
    const uid = req.body.uid;
    const userRef = db.collection('users').doc(uid);
    userRef.update({ tutorial: true }).then(() => res.json({ success: true })).catch(e => console.log(e));
});

module.exports = router;