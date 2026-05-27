const express = require('express');
const userRoute = require('./user.route');
const profilesRouter = require('../profiles/profiles.route');
const followerRouter = require('../follower/followers.route');
const coinsRouter = require('../coin/coins.route');

const router = express.Router();

router.use('/user', userRoute);
router.use('/users', userRoute);

router.use('/profiles', profilesRouter);
router.use('/follower', followerRouter);
router.use('/coins', coinsRouter);

module.exports = router;
