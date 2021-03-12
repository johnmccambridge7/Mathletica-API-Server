var express = require('express');
var router = express.Router();
var { db, admin } = require('../../models/firebase');

router.post('/getSession', async function(req, res) {
    const sid = req.body.sid;
    const sessionRef = db.collection('sessions').doc(sid);
    const session = await sessionRef.get();

    console.log('Fetching session: ', sid);

    if (session.exists) {
        const sessionData = session.data();
        res.json({ success: true, msg: sessionData });
    } else {
        res.json({ success: false, msg: {} });
    }
});

router.post('/getSessions', async function(req, res) {
    const uid = req.body.uid;

    const sessionRef = db.collection('sessions');
    const sessionSnapshot = await sessionRef.where('uid', '==', uid).orderBy('date', 'desc').get();
    const sessions = [];

    sessionSnapshot.forEach(doc => {
        // Update the session by adding the question id into the previously used
        
        sessions.push({ session: { data: doc.data(), id: doc.id} });
    });

    if (sessions.length > 0) {
        res.json({ success: true, msg: sessions });
    } else {
        res.json({ success: false, msg: [] });
    }
});

router.post('/session', async function(req, res) {
    let packet = {
        uid: req.body.uid,
        date: new Date().getTime(),
        topics: req.body.topics,
        type: req.body.multipleChoice ? 'multiple' : 'general',
        currentQuestion: '',
        // categories: req.body.categories,
        metadata: [],
        questionIDs: [],
        sessionData: {},
        remainingHearts: 3,
        viewSkills: req.body.viewSkills,
        multipleChoiceAnswer: "",
        blocked: [],
    };

    req.body.topics.forEach(topic => packet[topic] = []);

    // todo: generate metadata associated with each question in the multiple choice section

    db.collection('sessions').add(packet).then((docRef) => {
        res.json({ success: true, sid: docRef.id });
    }).catch((e) => {
        console.log(e);
        res.json({ success: false });
    });
});

router.post('/updateSession', async function(req, res) {
    const sid = req.body.sid;
    const field = req.body.field;
    const value = req.body.value;
    const type = req.body.type;

    let fieldValue; // (type === 'adjust') ? admin.firestore.FieldValue.increment(value) :

    switch (type) {
        case 'ADJUST':
            fieldValue = admin.firestore.FieldValue.increment(value);
            break;
        case 'UNION':
            fieldValue = admin.firestore.FieldValue.arrayUnion(value);
            break;
        default:
            fieldValue = value;
            break;
    }
    
    const sessionRef = db.collection('sessions').doc(sid);

    const packet = { [field]: fieldValue };

    sessionRef.update(packet).then(() => res.json({ success: true }) ).catch((e) => { console.log('Block', e); res.json({ success: false }); });
});

module.exports = router;