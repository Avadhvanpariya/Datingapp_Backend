const mongoose = require('mongoose');
const { TRANSACTION_STATUS, TRANSACTION_TYPES } = require('../constants/enums');

const coinTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(TRANSACTION_STATUS)
    },
    type: {
      type: String,
      enum: Object.values(TRANSACTION_TYPES),
      required: true
    },
    coins: { type: Number, required: true },          // Always positive value
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    description: { type: String, default: '' },
    relatedCallId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CallLog',
      default: null
    },
    relatedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    // Razorpay fields (populated for 'purchase' type only)
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null }
  },
  { timestamps: true }
);

// Index for paginated history queries sorted by date
coinTransactionSchema.index({ userId: 1, createdAt: -1 });

// Prevent duplicate payment processing at the database level (replay attack guard)
coinTransactionSchema.index({ razorpayPaymentId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('CoinTransaction', coinTransactionSchema);
