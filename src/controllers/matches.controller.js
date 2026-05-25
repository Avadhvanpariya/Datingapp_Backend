const Swipe = require('../models/swipe.model');
const User = require('../models/user.model');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');

/**
 * Handle swiping 'like'
 */
const likeUser = asyncHandler(async (req, res, next) => {
  const { targetUserId } = req.body;
  const currentUserId = req.user.id;

  if (!targetUserId) {
    return next(new AppError('Target user ID is required.', 400));
  }

  // Prevent swiping on yourself
  if (targetUserId === currentUserId) {
    return next(new AppError('You cannot swipe on yourself.', 400));
  }

  // Verify target user exists
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    return next(new AppError('Target user not found.', 404));
  }

  // Check if target user has already liked/superliked the current user
  const mutualSwipe = await Swipe.findOne({
    liker: targetUserId,
    liked: currentUserId,
    type: { $in: ['like', 'superlike'] }
  });

  let isMatch = false;

  if (mutualSwipe) {
    isMatch = true;
    
    // Update target's swipe to match status
    mutualSwipe.isMatch = true;
    await mutualSwipe.save();
  }

  // Upsert current user's swipe
  await Swipe.findOneAndUpdate(
    { liker: currentUserId, liked: targetUserId },
    { type: 'like', isMatch },
    { upsert: true, new: true }
  );

  res.status(200).json({
    success: true,
    isMatch,
    message: isMatch ? 'It is a mutual connection! 💖' : 'Like recorded'
  });
});

/**
 * Handle swiping 'superlike' (sparks)
 */
const superlikeUser = asyncHandler(async (req, res, next) => {
  const { targetUserId } = req.body;
  const currentUserId = req.user.id;

  if (!targetUserId) {
    return next(new AppError('Target user ID is required.', 400));
  }

  if (targetUserId === currentUserId) {
    return next(new AppError('You cannot superlike yourself.', 400));
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    return next(new AppError('Target user not found.', 404));
  }

  const mutualSwipe = await Swipe.findOne({
    liker: targetUserId,
    liked: currentUserId,
    type: { $in: ['like', 'superlike'] }
  });

  let isMatch = false;

  if (mutualSwipe) {
    isMatch = true;
    mutualSwipe.isMatch = true;
    await mutualSwipe.save();
  }

  await Swipe.findOneAndUpdate(
    { liker: currentUserId, liked: targetUserId },
    { type: 'superlike', isMatch },
    { upsert: true, new: true }
  );

  res.status(200).json({
    success: true,
    isMatch,
    message: isMatch ? 'Mutual spark connected! 🌟' : 'Superlike recorded'
  });
});

/**
 * Handle swiping 'pass'
 */
const passUser = asyncHandler(async (req, res, next) => {
  const { targetUserId } = req.body;
  const currentUserId = req.user.id;

  if (!targetUserId) {
    return next(new AppError('Target user ID is required.', 400));
  }

  await Swipe.findOneAndUpdate(
    { liker: currentUserId, liked: targetUserId },
    { type: 'pass', isMatch: false },
    { upsert: true, new: true }
  );

  res.status(200).json({
    success: true,
    message: 'Pass recorded'
  });
});

/**
 * Get all mutual matches
 */
const getMatchesList = asyncHandler(async (req, res, next) => {
  const currentUserId = req.user.id;

  // Retrieve matches where isMatch is true
  const matches = await Swipe.find({
    liker: currentUserId,
    isMatch: true
  }).populate('liked');

  const profiles = matches.map(m => {
    const u = m.liked;
    return {
      id: u._id.toString(),
      name: u.name || 'Anonymous Member',
      age: u.age,
      bio: u.bio || 'No bio added yet.',
      avatarUrl: u.avatar,
      occupation: u.occupation || 'Click Cupid Member',
      location: u.city ? `${u.city}, ${u.country || 'IN'}` : 'Location Unknown',
      interests: u.interests && u.interests.length > 0 ? u.interests : []
    };
  });

  res.status(200).json(profiles);
});

module.exports = {
  likeUser,
  superlikeUser,
  passUser,
  getMatchesList
};
