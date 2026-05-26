const express = require('express');
const { protect } = require('../../middleware/authorization/authorization');
const {
  getBalance,
  getCoinPacks,
  getTransactionHistory,
  createOrder,
  verifyPayment
} = require('../../controllers/coins.controller');

const router = express.Router();

// All coin endpoints require an active authenticated session
router.use(protect);

router.get('/balance', getBalance);
router.get('/packs', getCoinPacks);
router.get('/history', getTransactionHistory);
router.post('/create-order', createOrder);
router.post('/verify-payment', verifyPayment);

module.exports = router;
