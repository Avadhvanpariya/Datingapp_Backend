const Razorpay = require('razorpay');
const crypto = require('crypto');
require('../models/callLog.model');
const User = require('../models/user.model');
const CoinTransaction = require('../models/coinTransaction.model');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const { getPagination } = require('../../utils/pagination');

// Coin packs available for purchase
const COIN_PACKS = [
  { id: 'starter', label: 'Starter', coins: 50, priceINR: 49 },
  { id: 'popular', label: 'Popular', coins: 150, priceINR: 129 },
  { id: 'pro', label: 'Pro', coins: 500, priceINR: 399 },
  { id: 'elite', label: 'Elite', coins: 1200, priceINR: 899 }
];


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});


// ─── Get Current Coin Balance ─────────────────────────────────────────────────
const getBalance = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('coins');
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  res.status(200).json({
    success: true,
    coins: user.coins
  });
});

// ─── Get Coin Packs List ───────────────────────────────────────────────────────
const getCoinPacks = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: COIN_PACKS
  });
});

// ─── Get Transaction History ──────────────────────────────────────────────────
const getTransactionHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page, limit, skip } = getPagination(req, 20);

  const total = await CoinTransaction.countDocuments({ userId });

  const transactions = await CoinTransaction.find({ userId })
    .populate('relatedUserId', 'name avatar')
    .populate('relatedCallId', 'callType status duration')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    page,
    limit,
    total,
    hasMore: skip + limit < total,
    data: transactions
  });
});

// ─── Create Razorpay Order ────────────────────────────────────────────────────
const createOrder = asyncHandler(async (req, res, next) => {
  console.log('[RAZORPAY] createOrder called');
  console.log('[RAZORPAY] user:', req.user?.id);
  console.log('[RAZORPAY] body:', req.body);
  const { packId } = req.body;

  const pack = COIN_PACKS.find((p) => p.id === packId);
  if (!pack) {
    return next(new AppError('Invalid coin pack selected.', 400));
  }
  console.log('[RAZORPAY] selected pack:', pack);
  console.log('[RAZORPAY] creating order with:', {
    amount: pack.priceINR * 100,
    currency: 'INR'
  });

  const order = await razorpay.orders.create({
    amount: pack.priceINR * 100, // Razorpay expects paise
    currency: 'INR',
    receipt: `coins_${Date.now().toString().slice(-10)}`,
    notes: {
      userId: req.user.id,
      packId: pack.id,
      coins: pack.coins
    }
  });

  console.log('[RAZORPAY] order created:', order);
  res.status(200).json({
    success: true,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    pack,
    keyId: process.env.RAZORPAY_KEY_ID
  });
});

// ─── Verify Payment & Credit Coins ────────────────────────────────────────────
const verifyPayment = asyncHandler(async (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, packId } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !packId) {
    return next(new AppError('Missing required payment verification fields.', 400));
  }

  // Verify HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return next(new AppError('Payment verification failed. Invalid signature.', 400));
  }

  // Check for duplicate payment (prevent replay attacks — DB index is the second guard)
  const alreadyProcessed = await CoinTransaction.findOne({ razorpayPaymentId: razorpay_payment_id });
  if (alreadyProcessed) {
    return next(new AppError('This payment has already been processed.', 409));
  }

  // Verify the Razorpay order belongs to this user (order ownership check)
  let order;
  try {
    order = await razorpay.orders.fetch(razorpay_order_id);
  } catch {
    return next(new AppError('Could not verify order with payment provider.', 502));
  }

  if (!order || order.notes?.userId !== req.user.id) {
    return next(new AppError('Unauthorized: this order does not belong to your account.', 403));
  }

  const pack = COIN_PACKS.find((p) => p.id === packId);
  if (!pack) {
    return next(new AppError('Invalid coin pack.', 400));
  }

  // Credit coins atomically
  const user = await User.findById(req.user.id);
  if (!user) return next(new AppError('User not found.', 404));

  const balanceBefore = user.coins;
  user.coins += pack.coins;
  await user.save();

  await CoinTransaction.create({
    userId: user._id,
    type: 'purchase',
    coins: pack.coins,
    balanceBefore,
    balanceAfter: user.coins,
    description: `Purchased ${pack.label} pack — ${pack.coins} coins`,
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id
  });

  res.status(200).json({
    success: true,
    message: `${pack.coins} coins added to your account! 🎉`,
    newBalance: user.coins,
    coinsAdded: pack.coins
  });
});

module.exports = {
  getBalance,
  getCoinPacks,
  getTransactionHistory,
  createOrder,
  verifyPayment
};
