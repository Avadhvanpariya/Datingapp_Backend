const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '', trim: true },
  fileUrl: { type: String, default: null },
  fileType: { type: String, default: null }, // 'image', 'video', 'file'
  fileName: { type: String, default: null },
  isRead: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Compound index to speed up fetching message histories sorted by date
messageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
