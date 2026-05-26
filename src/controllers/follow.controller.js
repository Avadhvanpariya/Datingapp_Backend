const asyncHandler = require('../../utils/asyncHandler');
const sendResponse = require('../../utils/sendResponse');

const {
  followUserService,
  unfollowUserService,
  getFollowersService,
  getFollowingService
} = require('../service/follow.service');

/**
 * Follow a user
 */
const followUser = asyncHandler(async (req, res, next) => {
  const targetUserId = req.params.userId;
  const currentUserId = req.user.id;

  const result = await followUserService(
    targetUserId,
    currentUserId
  );

  return sendResponse(res, {
    statusCode: 201,
    success: true,
    message: result.message
  });
});

/**
 * Unfollow a user
 */
const unfollowUser = asyncHandler(async (req, res, next) => {
  const targetUserId = req.params.userId;
  const currentUserId = req.user.id;

  const result = await unfollowUserService(
    targetUserId,
    currentUserId
  );

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message
  });
});

/**
 * Get paginated followers list for a user with mutual follow state
 */
const getFollowers = asyncHandler(async (req, res, next) => {
  const targetUserId = req.params.userId || req.user.id;
  const currentUserId = req.user.id;

  const result = await getFollowersService(
    targetUserId,
    currentUserId,
    req
  );

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    meta: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      hasMore: result.hasMore
    },
    data: result.data
  });
});

/**
 * Get list of users a specific user is following
 */
const getFollowing = asyncHandler(async (req, res, next) => {
  const targetUserId = req.params.userId || req.user.id;
  const currentUserId = req.user.id;

  const result = await getFollowingService(
    targetUserId,
    currentUserId,
    req
  );

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    meta: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      hasMore: result.hasMore
    },
    data: result.data
  });
});

module.exports = {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing
};