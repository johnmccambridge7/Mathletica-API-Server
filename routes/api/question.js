var express = require('express');
var router = express.Router();
var { db, admin } = require('../../models/firebase');
var { uuidv4 } = require('../../controllers/general');

router.post('/question', async function(req, res) {
    const sid = req.body.sid;
    const uid = req.body.uid;

    const prevQuestionID = req.body.qid;
    const prevAnswers = req.body.answers;
    const prevStats = req.body.stats;

    const sessionRef = db.collection('sessions').doc(sid);
    const userRef = db.collection('users').doc(uid);

    const session = await sessionRef.get();
    
    if (session.exists) {
        const sessionData = session.data();
        const currentQuestion = sessionData.currentQuestion;
        const progress = [];
        let selectedQuestion = {};

        userRef.update({ currentSession: sid }).catch((e) => { console.log(e) });

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
            console.log('Updating Session: ', sid);

            let minimumBucket = "";
            let minimumSize = 1000;

            sessionData.topics.forEach(topic => {
                if (sessionData[topic].length < minimumSize) {
                    minimumSize = sessionData[topic].length;
                    minimumBucket = topic;
                }
            });

            const topic = minimumBucket;
            const previousQuestions = sessionData[topic]; // holds an array of each possible topic containing question ids

            console.log(sessionData[topic], topic, sid);

            // Query the main database for a question based on topic
            // .where('__name__', 'not-in', previousQuestions).

            let questionSnapshot; 
            if (previousQuestions.length === 0) {
                if (sessionData.type === 'multiple') {
                    questionSnapshot = questionRef.where('topic', '==', topic);
                } else {
                    questionSnapshot = questionRef.where('topics', 'array-contains', topic);
                }
            } else {
                if (sessionData.type === 'multiple') {
                    questionSnapshot = questionRef.where('topic', '==', topic).where('__name__', 'not-in', previousQuestions);
                } else {
                    questionSnapshot = questionRef.where('topics', 'array-contains', topic).where('__name__', 'not-in', previousQuestions);
                }
            }

            if (sessionData.type === 'multiple') {
                questionSnapshot = questionSnapshot.where('type', '==', 'multiple');
            }

            questionSnapshot = await questionSnapshot.get();

            const questionCandidates = [];

            // fetching a new question from the bank
            questionSnapshot.forEach(doc => {
                const data = doc.data();
                const type = data.type;

                questionCandidates.push({
                    data, // need to filter out the parts not relevant to the session
                    questionID: doc.id,
                    type: type ? type : 'general',
                    progress,
                    remainingHearts: type ? (type === 'multiple' ? 1 : 3) : 3,
                    viewSkills: sessionData.viewSkills,
                    timerEnabled: sessionData.timerEnabled,
                    blocked: [],
                    fullTopics: sessionData.topics,
                    example: sessionData.example !== undefined
                });
            });

            const position = Math.floor(Math.random() * questionCandidates.length);
            selectedQuestion = questionCandidates[position];

            // iterate over the selected question parts and add blocked tag if the topic is not relevant to the section
            

            let packet = {
                currentQuestion: selectedQuestion.questionID,
                remainingHearts: selectedQuestion.type === 'general' ? 3 : 1,
                multipleChoiceAnswer: '',
                blocked: []
            };

            // view solution? after revealing?
            // its the view solution!

            if (prevQuestionID) {
                const prevQuestion = await questionRef.doc(prevQuestionID).get();
                const prevQuestionData = prevQuestion.data();
                const prevQuestionType = prevQuestionData.type ? prevQuestionData.type : 'general';
                
                if (prevQuestionType === 'multiple') {
                    packet = {
                        ...packet,
                        [prevQuestionData.topic]: admin.firestore.FieldValue.arrayUnion(prevQuestionID),
                    }; 
                } else if (prevQuestionType === 'general')  {
                    prevQuestionData.topics.forEach(topic => packet[topic] = admin.firestore.FieldValue.arrayUnion(prevQuestionID));
                }

                if (prevQuestionType === 'general') {
                    const parts = prevQuestionData.parts;
                    
                    // determine the statistical relevance of the question answered
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
                    });
                } else if (prevQuestionType === 'multiple') {
                    questionRef.doc(prevQuestionID).update({
                        answered: 1, // answered + 1,
                        average: 1 // ((currentAvg * answered) + marks) / (answered + 1)
                    }).catch((e) => { console.log(e) });
                }

                packet = {
                    ...packet,
                    metadata: admin.firestore.FieldValue.arrayUnion({ aid:uuidv4(), id:prevQuestionID, answers:prevAnswers, stats:prevStats })
                };

                userRef.update({ lastQuestion:  admin.firestore.FieldValue.serverTimestamp() }).catch((e) => { console.log(e) });
            }
            
            // if the update fails, we might decrement the hearts below 0
            sessionRef.update(packet).then(() => {
                res.json({ success: true, msg: selectedQuestion });
            }).catch((e) => {
                console.log(e);
                res.json({ success: false });
            });
        } else {
            // question is present which has not been completed
            const query = questionRef.doc(sessionData.currentQuestion);
            const question = await query.get();
            selectedQuestion = { 
                data: question.data(),
                progress,
                type: question.data().type ? question.data().type : 'general',
                questionID: sessionData.currentQuestion,
                questionType: sessionData.type,
                remainingHearts: sessionData.remainingHearts,
                viewSkills: sessionData.viewSkills,
                timerEnabled: sessionData.timerEnabled,
                blocked: sessionData.blocked,
                fullTopics: sessionData.topics,
                example: sessionData.example !== undefined,
                multipleChoiceAnswer: sessionData.multipleChoiceAnswer ? sessionData.multipleChoiceAnswer : ''
            };

            res.json({ success: true, msg: selectedQuestion });
        }
    } else {
        res.json({ success: false, msg: {}});    
    }
});

module.exports = router;