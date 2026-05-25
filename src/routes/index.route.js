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
router.use('/user', userRouter);
router.use('/users', userRouter);
router.use('/profiles', profilesRouter);
router.use('/matches', matchesRouter);
router.use('/follower', followerRouter);
router.use('/posts', postsRouter);
router.use('/chats', chatsRouter);
router.use('/webrtc', webrtcRouter);
router.use('/coins', coinsRouter);

module.exports = router;
