var express    = require('express');        // call express
var app        = express();                 // define our app using express
var bodyParser = require('body-parser');
var admin = require("firebase-admin");
var firebase = require("firebase/app");
var serviceAccount = require("./service.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://mathletica.co.uk"
});

// heart animation is not working

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

const cors = require('cors');

require("firebase/auth");

const db = admin.firestore();

app.use(cors({
    origin: 'http://localhost:3000' // 'https://mathletica-9a3d0.web.app'
}));

// todo before launch:
// build leaderboard
// build performance report algorithm (strength/weakness)
//   

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 8080;        // set our port

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}

function Points(difficulty, obtainedMarks, averageMarks, timeTaken, timeAllowed) {
    difficulty = parseFloat(difficulty);
    obtainedMarks = parseFloat(obtainedMarks);
    averageMarks = parseFloat(averageMarks) > 0 ? parseFloat(averageMarks) : 1;

    const worth = (1/averageMarks) * (difficulty * obtainedMarks);
    // const timeBonus = (1 - timeTaken/timeAllowed) * worth; // maybe not add this in
    return parseInt(worth);
}

function sigmoid(object) {
    for (let [key, value] of Object.entries(object)) {
        object[key] = (1 / (1 + Math.E ** (-1 * value))) - 0.5
    }

    return object;
}

router.post('/login', function (req, res) {
    const email = req.body.email;
    const password = req.body.password;
});

router.post('/register', function (req, res) {
    const email = req.body.email;
    const password = req.body.password;
    const firstName = req.body.firstName;
    const lastName = req.body.lastName;
    firebase.auth().createUserWithEmailAndPassword(email, password).then((user) => {
        // add a new row to the users table
        const usersRef = db.collection('users');

        usersRef.doc(user.user.uid).set({
            email,
            firstName,
            lastName,
            points: 0,
            school: 'Plockton',
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

router.post('/getLeaderboard', async function(req, res){
    const uid = req.body.uid;
    // fetch the top 5 people and union with the uid position
    const usersRef = db.collection('users');
    const usersSnapshot = await usersRef.orderBy('points', 'desc').limit(5).get();
    const users = [];
    let userContained = false;

    usersSnapshot.forEach(doc => {
        const data = doc.data();
        users.push({ data: { points: data.points, username: data.username, school: data.school } });
        if (uid === doc.id) {
            userContained = true;
        }
    });

    res.json({ success: true, msg: users });
});

router.post('/reduceLife', function(req, res){
    const sid = req.body.sid;
    const sessionRef = db.collection('sessions').doc(sid);
    sessionRef.update({ remainingHearts: admin.firestore.FieldValue.increment(-1) });
    res.json({ success: true });
});

// need a route for getting the summary report based on a session id
router.post('/getSummaryReport', async function(req, res) {
    const sid = req.body.sid;
    
    const questionRef = db.collection('questions');
    const userRef = db.collection('users');
    const performanceRef = db.collection('performance');
    const sessionRef = db.collection('sessions').doc(sid);

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

            db.getAll(...refs).then(docs => {
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
                        const average = questionData.parts[answer.part].average;
                        const topic = questionData.parts[answer.part].topic;

                        partsCorrect += (answer.correct) ? 1 : 0;
                        points += Points(answer.difficulty, answer.marks, average);
            
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

                        unformattedScores.push({
                            question: number,
                            part: answer.part,
                            average: parseFloat(average ? average.toFixed(1) : 0),
                            marks: answer.marks,
                            points: Points(answer.difficulty, answer.marks, average),
                            averagePoints: Points(answer.difficulty, average, average)
                        });
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

                // increment points after question
                // userRef.update({ points: admin.firestore.FieldValue.increment(points) }).catch((e) => { console.log(e) });

                for (const [key, value] of Object.entries(userData.performance)) {
                    if (correctAnswers[key]) {
                        correctAnswers[key] += value;
                    } else {
                        correctAnswers[key] = value;
                    }
                }

                userRef.doc(sessionData.uid).update({
                    performance: correctAnswers
                }).catch((e) => { console.log(e) });

                // cache the summary report and fetch later
                performanceRef.doc(sid).set(report).then((docRef) => {
                    res.json({ success: true, msg: report });
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

router.post('/getSession', async function(req, res) {
    const sid = req.body.sid;
    const sessionRef = db.collection('sessions').doc(sid);
    const session = await sessionRef.get();

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
        /* sessionRef.update({
            questionIDs: admin.firestore.FieldValue.arrayUnion(doc.id)
        }).then(() => {
            res.json({ success: true, msg: doc.data() });
        }); */
        sessions.push({ session: { data: doc.data(), id: doc.id} });
    });

    if (sessions.length > 0) {
        res.json({ success: true, msg: sessions });
    } else {
        res.json({ success: false, msg: [] });
    }
});

// when you start session it resumes the previous

// ESTABLISH SESSION ROUTE:
// setup a session for the user with a session uid; returns a question and session id.
// session will store the uid, correct/incorrect stats, type of questions, topics etc.
router.post('/session', async function(req, res) {
    const packet = {
        uid: req.body.uid,
        date: new Date().getTime(),
        topics: req.body.topics,
        currentQuestion: '',
        started: false,
        // categories: req.body.categories,
        metadata: [],
        questionIDs: [],
        sessionData: {},
        remainingHearts: 3,
        viewSkills: req.body.viewSkills,
        timerEnabled: req.body.timerEnabled,
        blocked: [],
    };

    db.collection('sessions').add(packet).then((docRef) => {
        res.json({ success: true, sid: docRef.id });
    }).catch((e) => {
        console.log(e);
        res.json({ success: false });
    });
});

router.post('/blockPart', async function (req, res) {
    const sid = req.body.sid;
    const part = req.body.part;
    const sessionRef = db.collection('sessions').doc(sid);

    packet = { blocked: admin.firestore.FieldValue.arrayUnion(part) };
    sessionRef.update(packet).catch((e) => { console.log(e) });
    res.json({ success: true });
});

// FETCH QUESTION ROUTE:
// fetches a new question based on a session uid - session uid contains information about
// previously answered questions, list of topics, correct answers, analysis etc
router.post('/question', async function(req, res) {
    const sid = req.body.sid;
    const uid = req.body.uid;

    const prevQuestionID = req.body.qid;
    const prevAnswers = req.body.answers;
    const prevStats = req.body.stats;
 
    // Recall the current session:
    const sessionRef = db.collection('sessions').doc(sid);
    const userRef = db.collection('users').doc(uid);

    const session = await sessionRef.get();

    if (session.exists) {
        const sessionData = session.data();
        const topics = sessionData.topics;
        const previousQuestions = sessionData.questionIDs;
        const currentQuestion = sessionData.currentQuestion;
        const progress = [];
        let selectedQuestion = {};

        if (!sessionData.started) {
            sessionRef.update({ started: true }).catch((e) => { console.log(e) });
        }

        // Create a list of the progress as boolean array
        sessionData.metadata.forEach((item, index) => {
            progress.push(item.stats.allCorrect);
        });

        if (prevStats.allCorrect !== undefined) {
            progress.push(prevStats.allCorrect);
        } 

        // if the session exists, return the question from the last completed question
        const questionRef = db.collection('questions');

        // Update the session based on the previously recorded question and answer
        if (prevQuestionID.length > 0 || currentQuestion.length === 0) {
            console.log('Updating Session!');
            
            // Select a topic at random from the choices
            const topic = topics[Math.floor(Math.random() * topics.length)];
                    
            // Query the main database for a question based on topic
            // .where('__name__', 'not-in', previousQuestions).
            const questionSnapshot = await questionRef.where('topics', 'array-contains', topic).get();
            const questionCandidates = [];

            // fetching a new question from the bank
            questionSnapshot.forEach(doc => {
                questionCandidates.push({ data: doc.data(), 
                    questionID: doc.id,
                    progress,
                    remainingHearts: 3,
                    viewSkills: sessionData.viewSkills,
                    timerEnabled: sessionData.timerEnabled,
                    blocked: [],
                    fullTopics: sessionData.topics,
                    started: sessionData.started
                });
            });

            const position = Math.floor(Math.random() * questionCandidates.length);
            selectedQuestion = questionCandidates[position];

            let packet = {
                currentQuestion: selectedQuestion.questionID,
                remainingHearts: 3,
                blocked: []
            };

            if (prevQuestionID) {
                const prevQuestion = await questionRef.doc(prevQuestionID).get();
                const prevQuestionData = prevQuestion.data();
                const parts = prevQuestionData.parts;

                prevAnswers.forEach(answer => {
                    const marks = answer.marks;
                    const part = answer.part;
                    const answered = (parts[part].answered) ? parts[part].answered : 0;
                    const currentAvg = (parts[part].average) ? parts[part].average : 0;

                    // potential that people could destroy the average lol

                    const answeredField = 'parts.' + part + '.answered';
                    const averageField = 'parts.' + part + '.average';

                    console.log('Setting the average of:', prevQuestionID);

                    questionRef.doc(prevQuestionID).update({
                        [answeredField]: answered + 1,
                        [averageField]: ((currentAvg * answered) + marks) / (answered + 1)
                    }).catch((e) => { console.log(e) });

                    const points = Points(answer.difficulty, answer.marks, currentAvg);

                    /* console.log('Marks: ', answer);
                    console.log('Stats: ', answer.difficulty, answer.marks, currentAvg);
                    console.log('Points Earned: ', points); */

                    userRef.update({ points: admin.firestore.FieldValue.increment(points) }).catch((e) => { console.log(e) });
                });

                packet = {
                    ...packet,
                    metadata: admin.firestore.FieldValue.arrayUnion({ aid:uuidv4(), id:prevQuestionID, answers:prevAnswers, stats:prevStats })
                };
            }
            
            sessionRef.update(packet).catch((e) => { console.log(e) });
        } else {
            // question is present which has not been completed
            const query = questionRef.doc(sessionData.currentQuestion);
            const question = await query.get();
            selectedQuestion = { 
                data: question.data(),
                progress,
                questionID: sessionData.currentQuestion,
                remainingHearts: sessionData.remainingHearts,
                viewSkills: sessionData.viewSkills,
                timerEnabled: sessionData.timerEnabled,
                blocked: sessionData.blocked,
                started: sessionData.started,
                fullTopics: sessionData.topics,
            };
        }

        res.json({ success: true, msg: selectedQuestion });

    } else {
        res.json({ success: false, msg: {}});    
    }
});

// algorithm for determining new question:
// given a session uid, fetch the current session question_ids, and then
// fetch a new set of questions where qid not in the questions_ids set and
// topics contains the given set of topics
// choose a random topic from the list of topics and provide a question based on that
// once the question has been returned, unlock the parts based on the topics


app.use('/api', router);

// START THE SERVER
// =============================================================================
app.listen(port);
console.log('Magic happens on port ' + port);