const asyncHandler = require('../../utils/asyncHandler');
const sendResponse = require('../../utils/sendResponse');

const {
  findOrCreateConversationService,
  getActiveConversationsService,
  getConversationMessagesService,
  uploadChatFileService
} = require('../service/chat.service');

/**
 * Find or create a private conversation with another user
 */
const findOrCreateConversation = asyncHandler(async (req, res, next) => {
  const currentUserId = req.user.id;
  const { recipientId } = req.body;

  const conversation = await findOrCreateConversationService(currentUserId, recipientId);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    data: conversation
  });
});

/**
 * Get all active conversations for the logged-in user
 */
const getActiveConversations = asyncHandler(async (req, res, next) => {
  const currentUserId = req.user.id;

  const list = await getActiveConversationsService(currentUserId);

  return sendResponse(res, {
    statusCode: 200,
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
  const result = await getConversationMessagesService(currentUserId, conversationId, req);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    meta: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      hasMore: result.hasMore
    },
    data: result.data
  });
});

/**
 * Upload a chat file attachment (image, video, or generic file)
 */
const uploadChatFile = asyncHandler(async (req, res, next) => {
  const result = await uploadChatFileService(req.file);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    data: result
  });
});

module.exports = {
  findOrCreateConversation,
  getActiveConversations,
  getConversationMessages,
  uploadChatFile
};

