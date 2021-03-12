var router = require('express').Router();

router.use('/', require('./debug'));
router.use('/', require('./question'));
router.use('/', require('./ranking'));
router.use('/', require('./report'));
router.use('/', require('./session'));
router.use('/', require('./user'));

router.use(function(err, req, res, next){
  if(err.name === 'ValidationError'){
    return res.status(422).json({
      errors: Object.keys(err.errors).reduce(function(errors, key){
        errors[key] = err.errors[key].message;

        return errors;
      }, {})
    });
  }

  return next(err);
});

module.exports = router;