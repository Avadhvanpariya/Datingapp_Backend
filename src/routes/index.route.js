const express = require('express');
const authRouter = require('./auth/authIndex.route');
const userDepartment = require('./user/userIndex.route');
const socialDepartment = require('./social/socialIndex.route');

const router = express.Router();

router.use('/auth', authRouter);
router.use('/', userDepartment); // user routes (users,profiles,follower,coins)
router.use('/', socialDepartment); // social routes (matches,posts,chats,webrtc)

module.exports = router;
