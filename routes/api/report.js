var express = require('express');
var router = express.Router();
var { db, admin } = require('../../models/firebase');

var { calculatePoints, sigmoid } = require('../../controllers/general');
var { getRanking } = require('../../controllers/ranking');

router.post('/getSummaryReport', async function(req, res) {
    const sid = req.body.sid;
    
    const questionRef = db.collection('questions');
    const userRef = db.collection('users');
    const performanceRef = db.collection('performance');
    const sessionRef = db.collection('sessions').doc(sid);

    console.log(sid);

    const performanceReport = await performanceRef.doc(sid).get();

    if (!performanceReport.exists) {
        const session = await sessionRef.get();

        if (session.exists) {
            const sessionData = session.data();
            const user = await userRef.doc(sessionData.uid).get();
            const userData = user.data();

            let refs = [];

            for (const question of sessionData.metadata) {
                refs.push(questionRef.doc(question.id));
            }

            db.getAll(...refs).then(async docs => {
                let questionBody = {};
                for (const doc of docs) {
                    questionBody[doc.id] = doc.data();
                }

                const scores = [];
        
                let score = 0;
                let total = 0;
                let totalParts = 0;
                let partsCorrect = 0;
                let points = 0;
                let number = 1;

                let questionTopics = {};
                let correctAnswers = {};

                for (const question of sessionData.metadata) {
                    score += question.stats.marks;
                    total += question.stats.total;
        
                    totalParts += question.answers.length;
        
                    const questionData = questionBody[question.id];
                    const unformattedScores = [];

                    question.answers.forEach(answer => {
                        const average = (questionData.parts) ? questionData.parts[answer.part].average : questionData.average;
                        const topic = (questionData.parts) ? questionData.parts[answer.part].topic : questionData.topic;

                        partsCorrect += (answer.correct) ? 1 : 0;
                        points += calculatePoints(answer.difficulty, answer.marks, average);
            
                        performanceScore = (answer.correct) ? 1 : -1;
                        correctScore = (answer.correct) ? 1 : 0;

                        if (!questionTopics[topic]) {
                            questionTopics[topic] = 0;
                        }

                        if (!correctAnswers[topic]) {
                            correctAnswers[topic] = 0;
                        }
                        
                        questionTopics[topic] += performanceScore;
                        correctAnswers[topic] += correctScore;

                        // fix computing the average and points function
                        const formattedAverage = parseFloat(average ? average.toFixed(1) : 0);

                        console.log(answer);

                        const stat = {
                            question: number,
                            part: (answer.part) ? answer.part : 'a',
                            average: formattedAverage,
                            marks: answer.marks,
                            points: calculatePoints(answer.difficulty, answer.marks, average),
                            averagePoints: calculatePoints(answer.difficulty, average, average)
                        }

                        unformattedScores.push(stat);
                    });

                    // sort based on the parts
                    unformattedScores.sort((a, b) => {
                        if (a.part < b.part) return -1;
                        if (a.part > b.part) return 1;
                        return 0;
                    }).forEach(item => scores.push(item));

                    number += 1;
                }

                score = parseInt((100 * score) / total);
                const report = { score, scores, totalParts, partsCorrect, points, performance: sigmoid(questionTopics), correctAnswers };

                for (const [key, value] of Object.entries(userData.performance)) {
                    if (correctAnswers[key]) {
                        correctAnswers[key] += value;
                    } else {
                        correctAnswers[key] = value;
                    }
                }

                // making two calls to the user
                let globalRanking = await getRanking(sessionData.uid, userData, 'global');
                let localRanking = await getRanking(sessionData.uid, userData, 'local');

                // increment points and rank the user 
                userRef.doc(sessionData.uid).update({ 
                    points: admin.firestore.FieldValue.increment(points),
                    performance: correctAnswers
                }).then(() => {
                    userRef.doc(sessionData.uid).update({ 
                        prevGlobalRanking: globalRanking.ranking,
                        prevLocalRanking: localRanking.ranking,
                    }).then(() => {
                        // cache the summary report and fetch later
                        performanceRef.doc(sid).set(report).then((docRef) => {
                            res.json({ success: true, msg: report });
                        });
                    });
                }).catch((e) => {
                    console.log(e);
                    res.json({ success: false });
                });
            });
        } else {
            res.json({ success: false, msg: 'Session not found.'});
        };
    } else {
        res.json({ success: true, msg: { ...performanceReport.data() } });
    }
});


router.post('/getProgressReport', async function(req, res) {
    const uid = req.body.uid;

    const sessionRef = db.collection('sessions');
    const questionRef = db.collection('questions');
    const summaryRef = db.collection('summary');
    const sessionSnapshot = await sessionRef.where('uid', '==', uid).get();

    const questionIDs = {};
    const questionInfo = {};

    let refs = [];

    const summary = await summaryRef.doc(uid).get();

    if (!summary.exists) {
        sessionSnapshot.forEach(doc => {
            const data = doc.data();
            
            data.metadata.forEach(async question => {
                const id = question.id;
                
                const questionSnapshot = questionRef.where('__name__', '==', id).select('type', 'topic', 'topics');
                
                // linear check
                if (!questionIDs[id]) {
                    refs.push(questionSnapshot);
                    questionIDs[id] = true;
                }
            });
        });

        let processed = 0;

        refs.forEach(async ref => {
            const snapshot = await ref.get();
            snapshot.forEach(item => {
                processed += 1;
                const data = item.data();
                const type = data.type ? data.type : 'general';
                const topics = type === 'general' ? data.topics : [data.topic];

                topics.forEach(topic => {
                    if (!questionInfo[topic]) {
                        questionInfo[topic] = 1;
                    } else {
                        questionInfo[topic] += 1;
                    }
                });

                if (processed === refs.length) {
                    summaryRef.doc(uid).set(questionInfo).then((docRef) => {
                        res.json({ success: true, msg: questionInfo });
                    }).catch((e) => {
                        console.log(e);
                        res.json({ success: false });
                    });
                }
            });
        });
    } else {
        res.json({ success: true, msg: summary.data() });
    }

    // cache the results of the stats function too using FB function
    // generate a report of the count of each question in the database along with the questions the
    // user has answered based on the reports included in the progress summary
});

router.post('/report', async function (req, res) {
    const sid = req.body.sid;
    const uid = req.body.uid;
    const qid = req.body.qid;

    db.collection('reports').add({ sid, uid, qid }).then((docRef) => {
        res.json({ success: true });
    }).catch((e) => {
        console.log(e);
        res.json({ success: false });
    });
});

module.exports = router;