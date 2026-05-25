const express = require('express');
const { protect } = require('../middleware/authorization/authorization');
const { 
  likeUser, 
  superlikeUser, 
  passUser, 
  getMatchesList 
} = require('../controllers/matches.controller');

const router = express.Router();

// All swiping and matching endpoints require active sessions
router.use(protect);

router.post('/like', likeUser);
router.post('/superlike', superlikeUser);
router.post('/pass', passUser);
router.get('/', getMatchesList);

module.exports = router;
