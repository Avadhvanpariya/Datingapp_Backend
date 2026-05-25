const express = require('express');
const { googleLogin, phoneLogin } = require('../../controllers/user.controller');
const { authLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();

router.post('/google', authLimiter, googleLogin);
router.post('/phone-login', authLimiter, phoneLogin);

module.exports = router;
