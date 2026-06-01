const Post = require('../models/post.model');
const Follow = require('../models/follow.model');
const User = require('../models/user.model');
const AppError = require('../../utils/AppError');
const { getPagination } = require('../../utils/pagination');
const fs = require('fs');
const path = require('path');
const { uploadToCloudinary, deleteFromCloudinary } = require('../../utils/cloudinaryStorage');

/**
 * Create a new Post (using multipart form-data)
 */
const createPostService = async (text, userId, file) => {
    let mediaUrl = null;
    let finalMediaType = 'none';

    // Extract uploaded file properties from multer
    if (file) {
        // Try uploading to Cloudinary first
        const cloudinarySecureUrl = await uploadToCloudinary(file.path, 'posts');
        if (cloudinarySecureUrl) {
            mediaUrl = cloudinarySecureUrl;
        } else {
            mediaUrl = `/uploads/posts/${file.filename}`;
        }

        if (file.mimetype.startsWith('image/')) {
            finalMediaType = 'image';
        } else if (file.mimetype.startsWith('video/')) {
            finalMediaType = 'video';
        } else {
            finalMediaType = 'file'; // Supports generic file attachments
        }
    }

    // Create the post record
    const post = await Post.create({
        author: userId,
        text: text || '',
        mediaUrl,
        mediaType: finalMediaType
    });

    // Populate author details before returning
    const populatedPost = await Post.findById(post._id).populate('author', 'name avatar age occupation city');

    // Broadcast post creation event in real-time
    const { emitGlobal } = require('../../utils/socket');

    emitGlobal('post_created', populatedPost);

    return populatedPost;
};

/**
 * Get unified social feed posts
 */
const getFeedPostsService = async (currentUserId) => {
    // Retrieve the set of user IDs the current user is already following
    const Follow = require('../models/follow.model');

    const followingRecords = await Follow.find({ follower: currentUserId }).select('following');

    const followingIds = new Set(followingRecords.map(f => f.following.toString()));

    const posts = await Post.find()
        .populate('author', 'name avatar age occupation city')
        .populate('comments.author', 'name avatar')
        .sort({ createdAt: -1 });

    // Map post data to include helper state fields
    const feed = posts.map(p => {
        const json = p.toJSON();

        json.likesCount = p.likes.length;
        json.commentsCount = p.comments.length;
        json.hasLiked = p.likes.some(uId => uId.toString() === currentUserId);
        json.isFollowing = p.author ? followingIds.has(p.author._id.toString()) : false;

        return json;
    });

    return feed;
};

/**
 * Toggle Liking a Post
 */
const likePostService = async (
    postId,
    currentUserId
) => {
    const post = await Post.findById(postId);

    if (!post) {
        throw new AppError('Post not found.', 404);
    }

    const isLiked = post.likes.some(
        uId => uId.toString() === currentUserId
    );

    if (isLiked) {
        // Unlike
        post.likes = post.likes.filter(
            uId => uId.toString() !== currentUserId
        );
    } else {
        // Like
        post.likes.push(currentUserId);
    }

    await post.save();

    const { emitGlobal } = require('../../utils/socket');

    emitGlobal('post_liked', {
        postId: post._id,
        likesCount: post.likes.length,
        likerId: currentUserId,
        hasLiked: !isLiked
    });

    return {
        hasLiked: !isLiked,
        likesCount: post.likes.length,
        message: isLiked ? 'Post unliked.' : 'Post liked! ❤️'
    };
};

/**
 * Comment on a Post
 */
const commentOnPostService = async (postId, text, currentUserId) => {
    if (!text || !text.trim()) {
        throw new AppError('Comment text cannot be empty.', 400);
    }

    const post = await Post.findById(postId);

    if (!post) {
        throw new AppError('Post not found.', 404);
    }

    const comment = {
        author: currentUserId,
        text: text.trim(),
        createdAt: new Date()
    };

    post.comments.push(comment);

    await post.save();

    // Populate the comment author detail to return back to client
    const updatedPost = await Post.findById(postId)
        .populate('comments.author', 'name avatar');

    const latestComment =
        updatedPost.comments[
        updatedPost.comments.length - 1
        ];

    const { emitGlobal } = require('../../utils/socket');

    emitGlobal('comment_added', {
        postId: post._id,
        comment: latestComment,
        commentsCount: updatedPost.comments.length
    });

    return {
        comment: latestComment,
        commentsCount: updatedPost.comments.length
    };
};

/**
 * Record Share count
 */
const sharePostService = async (postId) => {
    const post = await Post.findById(postId);

    if (!post) {
        throw new AppError('Post not found.', 404);
    }

    post.shares += 1;

    await post.save();

    return {
        shares: post.shares
    };
};

/**
 * Retrieve My Posts with detailed Creator Stats
 */
const getMyPostsService = async (userId) => {
    // Retrieve posts created by the active user
    const posts = await Post.find({
        author: userId
    })
        .populate('author', 'name avatar')
        .populate('comments.author', 'name avatar')
        .sort({ createdAt: -1 });

    // Map each post to compile total analytics metrics
    const feed = posts.map(p => {
        const json = p.toJSON();

        json.likesCount = p.likes.length;
        json.commentsCount = p.comments.length;
        json.hasLiked = p.likes.some(
            uId => uId.toString() === userId
        );

        return json;
    });

    // Calculate sum totals
    const totalLikes = feed.reduce((acc, curr) => acc + curr.likesCount, 0);

    const totalComments = feed.reduce((acc, curr) => acc + curr.commentsCount, 0);

    const totalShares = feed.reduce((acc, curr) => acc + curr.shares, 0);

    // Retrieve active follower totals for the creator
    const Follow = require('../models/follow.model');

    const followersCount = await Follow.countDocuments({ following: userId });

    return {
        analytics: {
            totalPostsCount: feed.length,
            totalLikes,
            totalComments,
            totalShares,
            followersCount
        },
        data: feed
    };
};

/**
 * Retrieve paginated comments for a specific post
 */
const getPostCommentsService = async (postId, req) => {
    const { page, limit, skip } = getPagination(req, 15);

    const post = await Post.findById(postId);

    if (!post) {
        throw new AppError('Post not found.', 404);
    }

    const totalComments = post.comments.length;

    // Optimized project slicing using MongoDB $slice projection
    const populatedPost = await Post.findById(postId)
        .select({ comments: { $slice: [skip, limit] } })
        .populate('comments.author', 'name avatar');

    return {
        page,
        limit,
        totalComments,
        hasMore: skip + limit < totalComments,
        data: populatedPost.comments
    };
};

/**
 * Delete a Post (Author only)
 */
const deletePostService = async (postId, currentUserId) => {
    const post = await Post.findById(postId);

    if (!post) {
        throw new AppError('Post not found.', 404);
    }

    // Ensure author owns the post
    if (post.author.toString() !== currentUserId) {
        throw new AppError('Unauthorized. Only the author can delete this post.', 403);
    }

    // Unlink local media file from hard drive if present, or delete from Cloudinary
    if (post.mediaUrl) {
        if (post.mediaUrl.includes('cloudinary.com')) {
            await deleteFromCloudinary(post.mediaUrl);
        } else {
            const filename = post.mediaUrl.split('/').pop();
            const filePath = path.join(__dirname, '../../public/uploads/posts', filename);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (err) {
                    console.error('Failed to unlink media file:', err);
                }
            }
        }
    }

    await Post.findByIdAndDelete(postId);

    // Broadcast deletion in real-time
    const { emitGlobal } = require('../../utils/socket');

    emitGlobal('post_deleted', postId);

    return {
        message: 'Post deleted successfully. 🗑️'
    };
};

/**
 * Retrieve posts authored by a specific user (Public Feed view)
 */
const getUserPostsService = async (targetUserId, currentUserId) => {
    const posts = await Post.find({ author: targetUserId })
        .populate('author', 'name avatar age occupation city')
        .populate('comments.author', 'name avatar')
        .sort({ createdAt: -1 });

    // Map post data to include helper state fields
    const feed = posts.map(p => {
        const json = p.toJSON();

        json.likesCount = p.likes.length;
        json.commentsCount = p.comments.length;
        json.hasLiked = p.likes.some(
            uId => uId.toString() === currentUserId
        );

        return json;
    });

    return feed;
};

module.exports = {
    createPostService,
    getFeedPostsService,
    likePostService,
    commentOnPostService,
    sharePostService,
    getMyPostsService,
    getPostCommentsService,
    deletePostService,
    getUserPostsService
};