const asyncHandler = require('../../utils/asyncHandler');
const sendResponse = require('../../utils/sendResponse');

const {
  likeUserService,
  superlikeUserService,
  passUserService,
  getMatchesListService
} = require('../service/matches.service');

/**
 * Handle swiping 'like'
 */
const likeUser = asyncHandler(async (req, res, next) => {
  const { targetUserId } = req.body;
  const currentUserId = req.user.id;

  const result = await likeUserService(
    targetUserId,
    currentUserId
  );

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    isMatch: result.isMatch,
    message: result.message
  });
});

/**
 * Handle swiping 'superlike' (sparks)
 */
const superlikeUser = asyncHandler(async (req, res, next) => {
  const { targetUserId } = req.body;
  const currentUserId = req.user.id;

  const result = await superlikeUserService(
    targetUserId,
    currentUserId
  );

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    isMatch: result.isMatch,
    message: result.message
  });
});

/**
 * Handle swiping 'pass'
 */
const passUser = asyncHandler(async (req, res, next) => {
  const { targetUserId } = req.body;
  const currentUserId = req.user.id;

  const result = await passUserService(
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
 * Get all mutual matches
 */
const getMatchesList = asyncHandler(async (req, res, next) => {
  const currentUserId = req.user.id;

  const profiles = await getMatchesListService(currentUserId);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    data: profiles
  });
});

module.exports = {
  likeUser,
  superlikeUser,
  passUser,
  getMatchesList
};