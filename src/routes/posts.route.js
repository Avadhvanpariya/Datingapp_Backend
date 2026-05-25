const express = require('express');
const { protect } = require('../middleware/authorization/authorization');
const postUpload = require('../middleware/postUpload');
const {
  createPost,
  getFeedPosts,
  likePost,
  commentOnPost,
  sharePost,
  getMyPosts,
  getPostComments,
  deletePost,
  getUserPosts
} = require('../controllers/post.controller');

const router = express.Router();

router.use(protect);

router.post('/', postUpload.single('file'), createPost);
router.get('/feed', getFeedPosts);
router.get('/my-posts', getMyPosts);
router.get('/user/:userId', getUserPosts);
router.get('/:postId/comments', getPostComments);
router.post('/:postId/like', likePost);
router.post('/:postId/comment', commentOnPost);
router.post('/:postId/share', sharePost);
router.delete('/:postId', deletePost);

module.exports = router;
