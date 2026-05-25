const mongoose = require('mongoose');

const swipeSchema = new mongoose.Schema(
  {
    liker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    liked: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['like', 'pass', 'superlike'], required: true },
    isMatch: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// unique pairs to prevent duplicate swipes
swipeSchema.index({ liker: 1, liked: 1 }, { unique: true });
// Optimize stats calculations
swipeSchema.index({ liker: 1, type: 1 });
swipeSchema.index({ liker: 1, isMatch: 1 });

module.exports = mongoose.model('Swipe', swipeSchema);
