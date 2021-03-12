var db = require('../models/firebase');

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}

function calculatePoints(difficulty, obtainedMarks, averageMarks, timeTaken, timeAllowed) {
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

module.exports = { uuidv4, sigmoid, calculatePoints };