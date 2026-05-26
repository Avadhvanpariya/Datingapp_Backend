const express = require('express');
const authRouter = require('./auth/authIndex.route');
const userRouter = require('./user/userIndex.route');
const profilesRouter = require('./profiles/profiles.route');
const matchesRouter = require('./matches/matches.route');
const followerRouter = require('./follower/followers.route');
const postsRouter = require('./post/posts.route');
const chatsRouter = require('./chat/chats.route');
const webrtcRouter = require('./webrtc/webrtc.route');
const coinsRouter = require('./coin/coins.route');

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
