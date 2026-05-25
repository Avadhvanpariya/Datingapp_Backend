const Follow = require('../models/follow.model');
const User = require('../models/user.model');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');

/**
 * Follow a user
 */
const followUser = asyncHandler(async (req, res, next) => {
  const targetUserId = req.params.userId;
  const currentUserId = req.user.id;

  if (targetUserId === currentUserId) {
    return next(new AppError('You cannot follow yourself.', 400));
  }

  // Check if target user exists
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    return next(new AppError('User to follow not found.', 404));
  }

  // Check if already following
  const existingFollow = await Follow.findOne({
    follower: currentUserId,
    following: targetUserId
  });

  if (existingFollow) {
    return res.status(200).json({
      success: true,
      message: 'You are already following this user.'
    });
  }

  // Create follow record
  await Follow.create({
    follower: currentUserId,
    following: targetUserId
  });

  const { emitGlobal } = require('../../utils/socket');
  emitGlobal('user_followed', {
    followerId: currentUserId,
    followingId: targetUserId,
    isFollowing: true
  });

  res.status(201).json({
    success: true,
    message: `You followed ${targetUser.name || 'Anonymous User'} 💖`
  });
});

/**
 * Unfollow a user
 */
const unfollowUser = asyncHandler(async (req, res, next) => {
  const targetUserId = req.params.userId;
  const currentUserId = req.user.id;

  const followRecord = await Follow.findOneAndDelete({
    follower: currentUserId,
    following: targetUserId
  });

  if (!followRecord) {
    return next(new AppError('You are not following this user.', 400));
  }

  const { emitGlobal } = require('../../utils/socket');
  emitGlobal('user_followed', {
    followerId: currentUserId,
    followingId: targetUserId,
    isFollowing: false
  });

  res.status(200).json({
    success: true,
    message: 'User unfollowed successfully.'
  });
});

/**
 * Get paginated followers list for a user with mutual follow state
 */
const getFollowers = asyncHandler(async (req, res, next) => {
  const targetUserId = req.params.userId || req.user.id;
  const currentUserId = req.user.id;
  const { getPagination } = require('../../utils/pagination');
  const { page, limit, skip } = getPagination(req, 15);
  const mongoose = require('mongoose');

  // Count total followers first for pagination metadata
  const totalFollowers = await Follow.countDocuments({ following: targetUserId });

  const list = await Follow.aggregate([
    { $match: { following: new mongoose.Types.ObjectId(targetUserId) } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'follower',
        foreignField: '_id',
        as: 'userDetails'
      }
    },
    { $unwind: '$userDetails' },
    {
      $lookup: {
        from: 'follows',
        let: { listedUserId: '$follower' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$follower', new mongoose.Types.ObjectId(currentUserId)] },
                  { $eq: ['$following', '$$listedUserId'] }
                ]
              }
            }
          }
        ],
        as: 'currentFollowsListed'
      }
    },
    {
      $lookup: {
        from: 'follows',
        let: { listedUserId: '$follower' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$follower', '$$listedUserId'] },
                  { $eq: ['$following', new mongoose.Types.ObjectId(currentUserId)] }
                ]
              }
            }
          }
        ],
        as: 'listedFollowsCurrent'
      }
    },
    {
      $project: {
        _id: '$userDetails._id',
        name: '$userDetails.name',
        avatar: '$userDetails.avatar',
        bio: '$userDetails.bio',
        isFollowing: { $gt: [{ $size: '$currentFollowsListed' }, 0] },
        isFollowedBy: { $gt: [{ $size: '$listedFollowsCurrent' }, 0] },
        isMutual: {
          $and: [
            { $gt: [{ $size: '$currentFollowsListed' }, 0] },
            { $gt: [{ $size: '$listedFollowsCurrent' }, 0] }
          ]
        }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    page,
    limit,
    total: totalFollowers,
    hasMore: skip + limit < totalFollowers,
    data: list
  });
});

/**
 * Get list of users a specific user is following
 */
const getFollowing = asyncHandler(async (req, res, next) => {
  const targetUserId = req.params.userId || req.user.id;
  const currentUserId = req.user.id;
  const { getPagination } = require('../../utils/pagination');
  const { page, limit, skip } = getPagination(req, 15);
  const mongoose = require('mongoose');

  // Count total following first for pagination metadata
  const totalFollowing = await Follow.countDocuments({ follower: targetUserId });

  const list = await Follow.aggregate([
    { $match: { follower: new mongoose.Types.ObjectId(targetUserId) } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'following',
        foreignField: '_id',
        as: 'userDetails'
      }
    },
    { $unwind: '$userDetails' },
    {
      $lookup: {
        from: 'follows',
        let: { listedUserId: '$following' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$follower', new mongoose.Types.ObjectId(currentUserId)] },
                  { $eq: ['$following', '$$listedUserId'] }
                ]
              }
            }
          }
        ],
        as: 'currentFollowsListed'
      }
    },
    {
      $lookup: {
        from: 'follows',
        let: { listedUserId: '$following' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$follower', '$$listedUserId'] },
                  { $eq: ['$following', new mongoose.Types.ObjectId(currentUserId)] }
                ]
              }
            }
          }
        ],
        as: 'listedFollowsCurrent'
      }
    },
    {
      $project: {
        _id: '$userDetails._id',
        name: '$userDetails.name',
        avatar: '$userDetails.avatar',
        bio: '$userDetails.bio',
        isFollowing: { $gt: [{ $size: '$currentFollowsListed' }, 0] },
        isFollowedBy: { $gt: [{ $size: '$listedFollowsCurrent' }, 0] },
        isMutual: {
          $and: [
            { $gt: [{ $size: '$currentFollowsListed' }, 0] },
            { $gt: [{ $size: '$listedFollowsCurrent' }, 0] }
          ]
        }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    page,
    limit,
    total: totalFollowing,
    hasMore: skip + limit < totalFollowing,
    data: list
  });
});

module.exports = {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing
};
