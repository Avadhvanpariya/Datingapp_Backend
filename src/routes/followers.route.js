const express = require('express');
const { protect } = require('../middleware/authorization/authorization');
const {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing
} = require('../controllers/follow.controller');

const router = express.Router();

router.use(protect);

router.post('/:userId/follow', followUser);
router.delete('/:userId/unfollow', unfollowUser);
router.get('/followers', getFollowers);
router.get('/following', getFollowing);
router.get('/:userId/followers', getFollowers);
router.get('/:userId/following', getFollowing);

module.exports = router;
