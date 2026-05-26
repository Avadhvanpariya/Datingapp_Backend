const asyncHandler = require('../../utils/asyncHandler');
const sendResponse = require('../../utils/sendResponse');

const {
  googleLoginService,
  phoneLoginService,
  completeProfileService,
  getMeService,
  getUserStatsService
} = require('../service/user.service');

// ─── Google Login ─────────────────────────────────────────────────────────────
const googleLogin = asyncHandler(async (req, res, next) => {
  const { idToken } = req.body;

  const result = await googleLoginService(idToken);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Login successful',
    token: result.token,
    needsProfileCompletion: result.needsProfileCompletion,
    user: result.user
  });
});

// --- phone otp login ----------------
const phoneLogin = asyncHandler(async (req, res, next) => {
  const { firebaseToken, name, role } = req.body;

  const result = await phoneLoginService(firebaseToken, name, role);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Login successful',
    token: result.token,
    needsProfileCompletion: result.needsProfileCompletion,
    user: result.user
  });
});

// ─── Complete Profile ─────────────────────────────────────────────────────────
const completeProfile = asyncHandler(async (req, res, next) => {
  const result = await completeProfileService(req.body, req.user.id);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Login successful',
    token: result.token,
    needsProfileCompletion: result.needsProfileCompletion,
    user: result.user
  });
});

// ─── Get Me (Current User) ───────────────────────────────────────────────────
const getMe = asyncHandler(async (req, res, next) => {
  const result = await getMeService(req.user.id);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    token: result.token,
    needsProfileCompletion: result.needsProfileCompletion,
    user: result.user
  });
});

// ─── Get User Stats ──────────────────────────────────────────────────────────
const getUserStats = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  const result = await getUserStatsService(userId);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    data: result
  });
});

module.exports = {
  googleLogin,
  phoneLogin,
  completeProfile,
  getMe,
  getUserStats
};