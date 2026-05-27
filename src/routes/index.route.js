const express = require('express');
const authRouter = require('./auth/authIndex.route');
const userRouter = require('./user/userIndex.route');
const profilesRouter = require('./profiles.route');
const matchesRouter = require('./matches.route');
const followerRouter = require('./followers.route');
const postsRouter = require('./posts.route');
const chatsRouter = require('./chats.route');
const webrtcRouter = require('./webrtc.route');
const coinsRouter = require('./coins.route');

const router = express.Router();

router.use('/auth', authRouter);
router.use('/', userDepartment);
router.use('/', socialDepartment);

module.exports = router;
