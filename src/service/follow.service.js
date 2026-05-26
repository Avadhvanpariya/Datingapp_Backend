const Follow = require('../models/follow.model');
const User = require('../models/user.model');
const AppError = require('../../utils/AppError');

/**
 * Follow a user
 */
const followUserService = async (
    targetUserId,
    currentUserId
) => {
    if (targetUserId === currentUserId) {
        throw new AppError('You cannot follow yourself.', 400);
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
        throw new AppError('User to follow not found.', 404);
    }

    // Check if already following
    const existingFollow = await Follow.findOne({
        follower: currentUserId,
        following: targetUserId
    });

    if (existingFollow) {
        return {
            message: 'You are already following this user.'
        };
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

    return {
        message: `You followed ${targetUser.name || 'Anonymous User'} 💖`
    };
};

/**
 * Unfollow a user
 */
const unfollowUserService = async (
    targetUserId,
    currentUserId
) => {
    const followRecord = await Follow.findOneAndDelete({
        follower: currentUserId,
        following: targetUserId
    });

    if (!followRecord) {
        throw new AppError('You are not following this user.', 400);
    }

    const { emitGlobal } = require('../../utils/socket');

    emitGlobal('user_followed', {
        followerId: currentUserId,
        followingId: targetUserId,
        isFollowing: false
    });

    return {
        message: 'User unfollowed successfully.'
    };
};

/**
 * Get paginated followers list for a user with mutual follow state
 */
const getFollowersService = async (
    targetUserId,
    currentUserId,
    req
) => {
    const { getPagination } = require('../../utils/pagination');
    const { page, limit, skip } = getPagination(req, 15);
    const mongoose = require('mongoose');

    // Count total followers first for pagination metadata
    const totalFollowers = await Follow.countDocuments({
        following: targetUserId
    });

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

    return {
        page,
        limit,
        total: totalFollowers,
        hasMore: skip + limit < totalFollowers,
        data: list
    };
};

/**
 * Get list of users a specific user is following
 */
const getFollowingService = async (
    targetUserId,
    currentUserId,
    req
) => {
    const { getPagination } = require('../../utils/pagination');
    const { page, limit, skip } = getPagination(req, 15);
    const mongoose = require('mongoose');

    // Count total following first for pagination metadata
    const totalFollowing = await Follow.countDocuments({
        follower: targetUserId
    });

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

    return {
        page,
        limit,
        total: totalFollowing,
        hasMore: skip + limit < totalFollowing,
        data: list
    };
};

module.exports = {
    followUserService,
    unfollowUserService,
    getFollowersService,
    getFollowingService
};