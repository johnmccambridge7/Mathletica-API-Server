var express = require('express');
var router = express.Router();
var { db, admin } = require('../../models/firebase');

router.get('/stats', async function (req, res) {
    const questionRef = db.collection('questions');
    let dataset = [];
    questionRef.get().then((querySnapshot) => {
        const stats = {};
        let count = 0;
        querySnapshot.forEach((doc) => {
            questionData = doc.data();
            
            dataset.push({ url: (questionData.topics) ? questionData.imageURL : questionData.image, topics: (questionData.topics) ? questionData.topics : [questionData.topic], type: (questionData.topics) ? 'general' : 'multiple', difficulty: (questionData.topics) ? questionData.overallDifficulty : questionData.difficulty });

            /* if (questionData.topics) {
                questionData.topics.forEach(topic => {
                    if (stats[topic]) {
                        stats[topic] += 1;
                    } else {
                        stats[topic] = 1;
                    }
                });
            } else {
                if (stats[questionData.topic]) {
                    stats[questionData.topic] += 1;
                } else {
                    stats[questionData.topic] = 1;
                }
            }

            if (Object.keys(questionData).length < 8) {
                console.log(questionData, doc.id);
            }
            
            count += 1;*/
        });

        res.json({ msg: stats, count, dataset });
    });
});

module.exports = router;