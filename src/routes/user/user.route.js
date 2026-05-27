const express = require('express');
const { protect } = require('../../middleware/authorization/authorization');
const { completeProfile, getMe, getUserStats } = require('../../controllers/user.controller');

const router = express.Router();

router.use(protect);

router.get('/me', getMe);
router.get('/stats', getUserStats);
router.put('/complete-profile', completeProfile);

module.exports = router;
