const asyncHandler = require('../../utils/asyncHandler');
const sendResponse = require('../../utils/sendResponse');

const {
  createPostService,
  getFeedPostsService,
  likePostService,
  commentOnPostService,
  sharePostService,
  getMyPostsService,
  getPostCommentsService,
  deletePostService,
  getUserPostsService
} = require('../service/post.service');

/**
 * Create a new Post (using multipart form-data)
 */
const createPost = asyncHandler(async (req, res, next) => {
  const { text } = req.body;
  const userId = req.user.id;

  const result = await createPostService(
    text,
    userId,
    req.file
  );

  return sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Post created successfully! 🚀',
    data: result
  });
});

/**
 * Get unified social feed posts
 */
const getFeedPosts = asyncHandler(async (req, res, next) => {
  const currentUserId = req.user.id;

  const result = await getFeedPostsService(currentUserId);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    results: result.length,
    data: result
  });
});

/**
 * Toggle Liking a Post
 */
const likePost = asyncHandler(async (req, res, next) => {
  const postId = req.params.postId;
  const currentUserId = req.user.id;

  const result = await likePostService(
    postId,
    currentUserId
  );

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    hasLiked: result.hasLiked,
    likesCount: result.likesCount,
    message: result.message
  });
});

/**
 * Comment on a Post
 */
const commentOnPost = asyncHandler(async (req, res, next) => {
  const postId = req.params.postId;
  const { text } = req.body;
  const currentUserId = req.user.id;

  const result = await commentOnPostService(
    postId,
    text,
    currentUserId
  );

  return sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Comment posted!',
    comment: result.comment,
    commentsCount: result.commentsCount
  });
});

/**
 * Record Share count
 */
const sharePost = asyncHandler(async (req, res, next) => {
  const postId = req.params.postId;

  const result = await sharePostService(postId);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    shares: result.shares,
    message: 'Post share recorded.'
  });
});

/**
 * Retrieve My Posts with detailed Creator Stats
 */
const getMyPosts = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  const result = await getMyPostsService(userId);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    analytics: result.analytics,
    data: result.data
  });
});

/**
 * Retrieve paginated comments for a specific post
 */
const getPostComments = asyncHandler(async (req, res, next) => {
  const postId = req.params.postId;

  const result = await getPostCommentsService(
    postId,
    req
  );

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    meta: {
      page: result.page,
      limit: result.limit,
      totalComments: result.totalComments,
      hasMore: result.hasMore
    },
    data: result.data
  });
});

/**
 * Delete a Post (Author only)
 */
const deletePost = asyncHandler(async (req, res, next) => {
  const postId = req.params.postId;
  const currentUserId = req.user.id;

  const result = await deletePostService(
    postId,
    currentUserId
  );

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message
  });
});

/**
 * Retrieve posts authored by a specific user (Public Feed view)
 */
const getUserPosts = asyncHandler(async (req, res, next) => {
  const targetUserId = req.params.userId;
  const currentUserId = req.user.id;

  const result = await getUserPostsService(
    targetUserId,
    currentUserId
  );

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    results: result.length,
    data: result
  });
});

module.exports = {
  createPost,
  getFeedPosts,
  likePost,
  commentOnPost,
  sharePost,
  getMyPosts,
  getPostComments,
  deletePost,
  getUserPosts
};