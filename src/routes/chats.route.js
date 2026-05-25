const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { protect } = require('../middleware/authorization/authorization');
const chatUpload = require('../middleware/chatUpload');

// All chat routes are protected
router.use(protect);

router.post('/upload', chatUpload.single('file'), chatController.uploadChatFile);

router.route('/')
  .post(chatController.findOrCreateConversation)
  .get(chatController.getActiveConversations);

router.route('/:conversationId/messages')
  .get(chatController.getConversationMessages);

module.exports = router;
