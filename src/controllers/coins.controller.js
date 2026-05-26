const Razorpay = require('razorpay');
const crypto = require('crypto');
require('../models/callLog.model');
const asyncHandler = require('../../utils/asyncHandler');
const sendResponse = require('../../utils/sendResponse');

const {
  getBalanceService,
  getCoinPacksService,
  getTransactionHistoryService,
  createOrderService,
  verifyPaymentService
} = require('../service/coin.service');

// ─── Get Current Coin Balance ─────────────────────────────────────────────────
const getBalance = asyncHandler(async (req, res) => {
  const result = await getBalanceService(req.user.id);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    data: result
  });
});

// ─── Get Coin Packs List ───────────────────────────────────────────────────────
const getCoinPacks = asyncHandler(async (req, res) => {
  const result = await getCoinPacksService();

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    data: result
  });
});

// ─── Get Transaction History ──────────────────────────────────────────────────
const getTransactionHistory = asyncHandler(async (req, res) => {
  const result = await getTransactionHistoryService(req.user.id, req);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    meta: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      hasMore: result.hasMore
    },
    data: result.data
  });
});

// ─── Create Razorpay Order ────────────────────────────────────────────────────
const createOrder = asyncHandler(async (req, res, next) => {
  // console.log('[RAZORPAY] createOrder called');
  // console.log('[RAZORPAY] user:', req.user?.id);
  // console.log('[RAZORPAY] body:', req.body);

  const result = await createOrderService(req.user.id, req.body);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    data: result
  });
});

// ─── Verify Payment & Credit Coins ────────────────────────────────────────────
const verifyPayment = asyncHandler(async (req, res, next) => {
  const result = await verifyPaymentService(req.user.id, req.body);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: {
      newBalance: result.newBalance,
      coinsAdded: result.coinsAdded
    }
  });
});

module.exports = {
  getBalance,
  getCoinPacks,
  getTransactionHistory,
  createOrder,
  verifyPayment
};