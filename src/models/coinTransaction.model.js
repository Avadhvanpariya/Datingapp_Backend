const mongoose = require('mongoose');

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
      enum: ['pending', 'completed', 'failed'],
    },
    type: {
      type: String,
      enum: [
        'purchase',              // Razorpay top-up
        'connection_fee_debit',  // fee deducted from caller on pickup
        'connection_fee_credit', // fee credited to host on pickup
        'per_minute_debit',      // Per-minute charge deducted from caller
        'per_minute_credit',     // Per-minute charge credited to host
        'refund'                 // Manual / system refund
      ],
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
    razorpayPaymentId: { type: String, default: null}
  },
  { timestamps: true }
);

// Index for paginated history queries sorted by date
coinTransactionSchema.index({ userId: 1, createdAt: -1 });

// Prevent duplicate payment processing at the database level (replay attack guard)
coinTransactionSchema.index({ razorpayPaymentId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('CoinTransaction', coinTransactionSchema);
