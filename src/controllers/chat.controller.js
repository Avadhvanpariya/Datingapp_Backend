const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const User = require('../models/user.model');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');

/**
 * Find or create a private conversation with another user
 */
const findOrCreateConversation = asyncHandler(async (req, res, next) => {
  const currentUserId = req.user.id;
  const { recipientId } = req.body;

  if (!recipientId) {
    return next(new AppError('Recipient user ID is required.', 400));
  }

  if (currentUserId === recipientId) {
    return next(new AppError('You cannot start a chat conversation with yourself.', 400));
  }

  // Verify recipient exists
  const recipientExists = await User.findById(recipientId);
  if (!recipientExists) {
    return next(new AppError('Recipient user not found.', 404));
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

  res.status(200).json({
    success: true,
    data: conversation
  });
});

/**
 * Get all active conversations for the logged-in user
 */
const getActiveConversations = asyncHandler(async (req, res, next) => {
  const currentUserId = req.user.id;

  const list = await Conversation.find({
    participants: currentUserId
  })
    .populate('participants', 'name avatar bio city occupation age')
    .populate({
      path: 'lastMessage',
      select: 'text sender isRead createdAt fileUrl fileType fileName'
    })
    .sort({ updatedAt: -1 });

  res.status(200).json({
    success: true,
    data: list
  });
});

/**
 * Get paginated message history for a conversation
 */
const getConversationMessages = asyncHandler(async (req, res, next) => {
  const currentUserId = req.user.id;
  const { conversationId } = req.params;
  const { getPagination } = require('../../utils/pagination');
  const { page, limit, skip } = getPagination(req, 30);

  // Verify conversation exists and user is a participant
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return next(new AppError('Conversation not found.', 404));
  }

  const isParticipant = conversation.participants.some(
    (pId) => pId.toString() === currentUserId.toString()
  );
  if (!isParticipant) {
    return next(new AppError('You are not authorized to access this conversation.', 403));
  }

  const totalMessages = await Message.countDocuments({ conversationId });

  // Fetch newest messages first for historical scrolling
  const messages = await Message.find({ conversationId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    page,
    limit,
    total: totalMessages,
    hasMore: skip + limit < totalMessages,
    data: messages.reverse() // Return in chronological order (oldest to newest) for UI rendering
  });
});

/**
 * Upload a chat file attachment (image, video, or generic file)
 */
const uploadChatFile = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('No file attachment uploaded.', 400));
  }

  const relativeUrl = `/uploads/chats/${req.file.filename}`;
  let fileType = 'file';

  if (req.file.mimetype.startsWith('image/')) {
    fileType = 'image';
  } else if (req.file.mimetype.startsWith('video/')) {
    fileType = 'video';
  }

  res.status(200).json({
    success: true,
    fileUrl: relativeUrl,
    fileType,
    fileName: req.file.originalname
  });
});

module.exports = {
  findOrCreateConversation,
  getActiveConversations,
  getConversationMessages,
  uploadChatFile
};
