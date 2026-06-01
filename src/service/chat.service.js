const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const User = require('../models/user.model');
const AppError = require('../../utils/AppError');

/**
 * Find or create a private conversation with another user
 */
const findOrCreateConversationService = async (currentUserId, recipientId) => {
    if (!recipientId) {
        throw new AppError('Recipient user ID is required.', 400);
    }

    if (currentUserId === recipientId) {
        throw new AppError('You cannot start a chat conversation with yourself.', 400);
    }

    // Verify recipient exists
    const recipientExists = await User.findById(recipientId);

    if (!recipientExists) {
        throw new AppError('Recipient user not found.', 404);
    }

    // Find private conversation containing exactly these two participants
    let conversation = await Conversation.findOne({
        participants: { $all: [currentUserId, recipientId], $size: 2 }
    }).populate('participants', 'name avatar bio city occupation age');

    // Create new conversation if none exists
    if (!conversation) {
        try {
            conversation = await Conversation.create({
                participants: [currentUserId, recipientId]
            });

            conversation = await Conversation.findById(conversation._id).populate('participants', 'name avatar bio city occupation age');

            // Notify the recipient in real-time about the newly created conversation
            try {
                const { emitToRoom } = require('../../utils/socket');

                emitToRoom(recipientId, 'new_conversation', conversation);
            } catch (socketErr) {
                console.error('Error emitting new_conversation via socket:', socketErr);
            }
        } catch (err) {
            // Catch parallel duplicate creation error and fetch existing instead
            if (err.code === 11000) {
                conversation = await Conversation.findOne({
                    participants: { $all: [currentUserId, recipientId], $size: 2 }
                }).populate('participants', 'name avatar bio city occupation age');
            } else {
                throw err;
            }
        }
    }

    return conversation;
};

/**
 * Get all active conversations for the logged-in user
 */
const getActiveConversationsService = async (currentUserId) => {
    const list = await Conversation.find({
        participants: currentUserId
    })
        .populate('participants', 'name avatar bio city occupation age')
        .populate({
            path: 'lastMessage',
            select: 'text sender isRead createdAt fileUrl fileType fileName'
        })
        .sort({ updatedAt: -1 });

    return list;
};

/**
 * Get paginated message history for a conversation
 */
const getConversationMessagesService = async (
    currentUserId,
    conversationId,
    req
) => {
    const { getPagination } = require('../../utils/pagination');
    const { page, limit, skip } = getPagination(req, 30);

    // Verify conversation exists and user is a participant
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
        throw new AppError('Conversation not found.', 404);
    }

    const isParticipant = conversation.participants.some(
        (pId) => pId.toString() === currentUserId.toString()
    );

    if (!isParticipant) {
        throw new AppError('You are not authorized to access this conversation.', 403);
    }

    const totalMessages = await Message.countDocuments({ conversationId });

    // Fetch newest messages first for historical scrolling
    const messages = await Message.find({ conversationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    return {
        page,
        limit,
        total: totalMessages,
        hasMore: skip + limit < totalMessages,
        data: messages.reverse() // Return in chronological order (oldest to newest) for UI rendering
    };
};

const { uploadToCloudinary } = require('../../utils/cloudinaryStorage');

/**
 * Upload a chat file attachment (image, video, or generic file)
 */
const uploadChatFileService = async (file) => {
    if (!file) {
        throw new AppError('No file attachment uploaded.', 400);
    }

    let fileUrl = `/uploads/chats/${file.filename}`;
    // Try uploading to Cloudinary first
    const cloudinarySecureUrl = await uploadToCloudinary(file.path, 'chats');
    if (cloudinarySecureUrl) {
        fileUrl = cloudinarySecureUrl;
    }

    let fileType = 'file';

    if (file.mimetype.startsWith('image/')) {
        fileType = 'image';
    } else if (file.mimetype.startsWith('video/')) {
        fileType = 'video';
    }

    return {
        fileUrl,
        fileType,
        fileName: file.originalname
    };
};

module.exports = {
    findOrCreateConversationService,
    getActiveConversationsService,
    getConversationMessagesService,
    uploadChatFileService
};