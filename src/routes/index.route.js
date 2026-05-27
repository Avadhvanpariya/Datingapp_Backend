const express = require('express');
const authRouter = require('./auth/authIndex.route');
const userDepartment = require('./user/userIndex.route');
const socialDepartment = require('./social/socialIndex.route');

const router = express.Router();

router.use('/auth', authRouter);
router.use('/', userDepartment);
router.use('/', socialDepartment);

module.exports = router;
