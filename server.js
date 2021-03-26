var express    = require('express');        // call express
var app        = express();                 // define our app using express
var bodyParser = require('body-parser');

const cors = require('cors');

app.use(cors({
    origin: 'https://mathletica.co.uk'
}));

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 8080;
var router = express.Router();

app.use(require('./routes'));

// FETCH QUESTION ROUTE:
// fetches a new question based on a session uid - session uid contains information about
// previously answered questions, list of topics, correct answers, analysis etc


// algorithm for determining new question:
// given a session uid, fetch the current session question_ids, and then
// fetch a new set of questions where qid not in the questions_ids set and
// topics contains the given set of topics
// choose a random topic from the list of topics and provide a question based on that
// once the question has been returned, unlock the parts based on the topics

var server = app.listen(port);
console.log('Magic happens on port ' + port);