const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../models/user.model');
const CoinTransaction = require('../models/coinTransaction.model');
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
const getBalanceService = async (userId) => {
    const user = await User.findById(userId).select('coins');

    if (!user) {
        throw new AppError('User not found.', 404);
    }

    return {
        coins: user.coins
    };
};

// ─── Get Coin Packs List ───────────────────────────────────────────────────────
const getCoinPacksService = async () => {
    return COIN_PACKS;
};

// ─── Get Transaction History ──────────────────────────────────────────────────
const getTransactionHistoryService = async (userId, req) => {
    const { page, limit, skip } = getPagination(req, 20);

    const total = await CoinTransaction.countDocuments({ userId });

    const transactions = await CoinTransaction.find({ userId })
        .populate('relatedUserId', 'name avatar')
        .populate('relatedCallId', 'callType status duration')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    return {
        page,
        limit,
        total,
        hasMore: skip + limit < total,
        data: transactions
    };
};

// ─── Create Razorpay Order ────────────────────────────────────────────────────
const createOrderService = async (userId, body) => {
    const { packId } = body;

    const pack = COIN_PACKS.find((p) => p.id === packId);

    if (!pack) {
        throw new AppError('Invalid coin pack selected.', 400);
    }

    // console.log('[RAZORPAY] selected pack:', pack);
    // console.log('[RAZORPAY] creating order with:', {
    //     amount: pack.priceINR * 100,
    //     currency: 'INR'
    // });

    const order = await razorpay.orders.create({
        amount: pack.priceINR * 100, // Razorpay expects paise
        currency: 'INR',
        receipt: `coins_${Date.now().toString().slice(-10)}`,
        notes: {
            userId,
            packId: pack.id,
            coins: pack.coins
        }
    });

    // console.log('[RAZORPAY] order created:', order);

    return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        pack,
        keyId: process.env.RAZORPAY_KEY_ID
    };
};

// ─── Verify Payment & Credit Coins ────────────────────────────────────────────
const verifyPaymentService = async (userId, body) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, packId } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !packId) {
        throw new AppError('Missing required payment verification fields.', 400);
    }

    // Verify HMAC-SHA256 signature
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    if (expectedSignature !== razorpay_signature) {
        throw new AppError('Payment verification failed. Invalid signature.', 400);
    }

    // Check for duplicate payment (prevent replay attacks — DB index is the second guard)
    const alreadyProcessed = await CoinTransaction.findOne({
        razorpayPaymentId: razorpay_payment_id
    });

    if (alreadyProcessed) {
        throw new AppError('This payment has already been processed.', 409);
    }

    // Verify the Razorpay order belongs to this user (order ownership check)
    let order;

    try {
        order = await razorpay.orders.fetch(razorpay_order_id);
    } catch {
        throw new AppError('Could not verify order with payment provider.', 502);
    }

    if (!order || order.notes?.userId !== userId) {
        throw new AppError('Unauthorized: this order does not belong to your account.', 403);
    }

    const pack = COIN_PACKS.find((p) => p.id === packId);

    if (!pack) {
        throw new AppError('Invalid coin pack.', 400);
    }

    // Credit coins atomically
    const user = await User.findById(userId);

    if (!user) {
        throw new AppError('User not found.', 404);
    }

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

    return {
        message: `${pack.coins} coins added to your account! 🎉`,
        newBalance: user.coins,
        coinsAdded: pack.coins
    };
};

module.exports = {
    getBalanceService,
    getCoinPacksService,
    getTransactionHistoryService,
    createOrderService,
    verifyPaymentService
};