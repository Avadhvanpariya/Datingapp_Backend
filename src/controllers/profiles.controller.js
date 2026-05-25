const User = require('../models/user.model');
const Swipe = require('../models/swipe.model');
const asyncHandler = require('../../utils/asyncHandler');

const getRecommendations = asyncHandler(async (req, res, next) => {
  const currentUserId = req.user.id;

  // Find IDs of all users that the current user has already swiped on (liked, passed, superliked)
  const swipedRecords = await Swipe.find({ liker: currentUserId }).select('liked');
  const swipedUserIds = swipedRecords.map(s => s.liked);

  // Query only active users excluding the logged-in user themselves and already swiped profiles
  const users = await User.find({
    _id: { $ne: currentUserId, $nin: swipedUserIds },
    isActive: true
  });

  const profiles = users.map(u => ({
    id: u._id.toString(),
    name: u.name || 'Anonymous Member',
    age: u.age,
    bio: u.bio || 'No profile bio added yet.',
    avatarUrl: u.avatar,
    occupation: u.occupation || 'Click Cupid Member',
    location: u.city ? `${u.city}, ${u.country || 'IN'}` : 'Location Unknown',
    interests: u.interests && u.interests.length > 0 ? u.interests : ['Dating', 'Romance', 'Conversations'],
    matchPercentage: 0
  }));

  res.status(200).json(profiles);
});

/**
 * Retrieve public profile details safely without exposing sensitive data
 */
const getPublicProfile = asyncHandler(async (req, res, next) => {
  const targetUserId = req.params.userId;
  const currentUserId = req.user.id;

  const targetUser = await User.findById(targetUserId).select('name avatar bio interests city age occupation');

  if (!targetUser) {
    const AppError = require('../../utils/AppError');
    return next(new AppError('User profile not found.', 404));
  }

  const Follow = require('../models/follow.model');
  const Post = require('../models/post.model');

  // Trigger high-performance index-assisted queries in parallel
  const [followersCount, followingCount, totalPostsCount, isFollowingRecord, currentFollowing] = await Promise.all([
    Follow.countDocuments({ following: targetUserId }),
    Follow.countDocuments({ follower: targetUserId }),
    Post.countDocuments({ author: targetUserId }),
    Follow.findOne({ follower: currentUserId, following: targetUserId }),
    currentUserId !== targetUserId
      ? Follow.find({ follower: currentUserId }).distinct('following')
      : Promise.resolve([])
  ]);

  const mutualFollowsCount = currentUserId !== targetUserId
    ? await Follow.countDocuments({ follower: targetUserId, following: { $in: currentFollowing } })
    : 0;

  res.status(200).json({
    success: true,
    data: {
      _id: targetUser._id,
      name: targetUser.name || 'Anonymous Member',
      avatar: targetUser.avatar,
      bio: targetUser.bio || 'No profile bio added yet.',
      interests: targetUser.interests || [],
      city: targetUser.city || 'Location Unknown',
      age: targetUser.age,
      occupation: targetUser.occupation || 'Click Cupid Member',
      followersCount,
      followingCount,
      totalPostsCount,
      isFollowing: !!isFollowingRecord,
      mutualFollowsCount
    }
  });
});

module.exports = {
  getRecommendations,
  getPublicProfile
};
