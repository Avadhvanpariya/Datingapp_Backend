const express = require('express');
const matchesRouter = require('../matches/matches.route');
const postsRouter = require('../post/posts.route');
const chatsRouter = require('../chat/chats.route');
const webrtcRouter = require('../webrtc/webrtc.route');

const router = express.Router();

router.use('/matches', matchesRouter);
router.use('/posts', postsRouter);
router.use('/chats', chatsRouter);
router.use('/webrtc', webrtcRouter);

module.exports = router;
