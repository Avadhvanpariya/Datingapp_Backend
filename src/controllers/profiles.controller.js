const asyncHandler = require('../../utils/asyncHandler');
const sendResponse = require('../../utils/sendResponse');

const {
  getRecommendationsService,
  getPublicProfileService
} = require('../service/profiles.service');

const getRecommendations = asyncHandler(async (req, res, next) => {
  const currentUserId = req.user.id;

  const profiles = await getRecommendationsService(currentUserId);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    data: profiles
  });
});

/**
 * Retrieve public profile details safely without exposing sensitive data
 */
const getPublicProfile = asyncHandler(async (req, res, next) => {
  const targetUserId = req.params.userId;
  const currentUserId = req.user.id;

  const result = await getPublicProfileService(
    targetUserId,
    currentUserId
  );

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    data: result
  });
});

module.exports = {
  getRecommendations,
  getPublicProfile
};