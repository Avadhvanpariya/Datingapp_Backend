const express = require('express');
const router = express.Router();
const chatController = require('../../controllers/chat.controller');
const { protect } = require('../../middleware/authorization/authorization');
const chatUpload = require('../../middleware/chatUpload');
const compressMedia = require('../../middleware/compressMedia');

// All chat routes are protected
router.use(protect);

router.post('/upload', chatUpload.single('file'), compressMedia, chatController.uploadChatFile);

router.route('/')
  .post(chatController.findOrCreateConversation)
  .get(chatController.getActiveConversations);

router.route('/:conversationId/messages')
  .get(chatController.getConversationMessages);

module.exports = router;
