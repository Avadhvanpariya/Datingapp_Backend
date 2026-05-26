const express = require('express');
const { protect } = require('../../middleware/authorization/authorization');
const { getRecommendations, getPublicProfile } = require('../../controllers/profiles.controller');

const router = express.Router();

router.use(protect);

router.get('/recommendations', getRecommendations);
router.get('/:userId', getPublicProfile);

module.exports = router;
