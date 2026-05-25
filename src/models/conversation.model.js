const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  uniqueKey: { type: String, unique: true }
}, {
  timestamps: true
});

// Automatically generate unique key prior to saving
conversationSchema.pre('save', function(next) {
  if (this.participants && this.participants.length === 2) {
    this.uniqueKey = this.participants.map(p => p.toString()).sort().join('-');
  }
  next();
});

// Index the participants array for ultra-fast conversation lookups
conversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
