const mongoose = require('mongoose');

const followerchema = new mongoose.Schema(
  {
    follower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    following: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

// users cannot follow someone multiple times
followerchema.index({ follower: 1, following: 1 }, { unique: true });

module.exports = mongoose.model('Follow', followerchema);
