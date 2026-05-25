

const mongoose = require('mongoose');
const User = require('../src/models/user.model');
const CoinTransaction = require('../src/models/coinTransaction.model');

// ─── Rate Constants ────────────────────────────────────────────────────────────
const COIN_RATES = {
  audio: {
    connectionFee: 2, // flat fee on pickup
    perMinute: 1      // charged every 60 s
  },
  video: {
    connectionFee: 5,
    perMinute: 3
  }
};

// Minimum coins required to initiate a call (connectionFee + 1 minute buffer)
const MIN_COINS_TO_CALL = {
  audio: COIN_RATES.audio.connectionFee + COIN_RATES.audio.perMinute, // 3
  video: COIN_RATES.video.connectionFee + COIN_RATES.video.perMinute  // 8
};

// { callId -> { timeoutId, callerId, receiverId, callType, minutesElapsed } }
const activeBillingTimers = new Map();

// ─── Internal: Atomic Transaction Helper ──────────────────────────────────────


// Record a coin transaction and update the user's balance
// Must always be called inside an active transaction session.

async function _recordTransaction(session, userId, coinsChange, type, opts = {}) {
  // Use findOneAndUpdate for atomic read-modify-write within the session
  const balanceBefore = await User.findById(userId).session(session).then((u) => {
    if (!u) throw new Error(`User ${userId} not found`);
    if (u.coins + coinsChange < 0) throw new Error('Insufficient coins');
    return u.coins;
  });

  const balanceAfter = balanceBefore + coinsChange;

  await User.findByIdAndUpdate(
    userId,
    { $inc: { coins: coinsChange } },
    { session, new: true }
  );

  await CoinTransaction.create(
    [{
      userId,
      type,
      coins: Math.abs(coinsChange),
      balanceBefore,
      balanceAfter,
      description: opts.description || '',
      relatedCallId: opts.callId || null,
      relatedUserId: opts.relatedUserId || null
    }],
    { session }
  );

  return { coins: balanceAfter };
}


// Check whether the caller has enough coins to start a call.
async function checkCanCall(callerId, callType) {
  const type = callType === 'video' ? 'video' : 'audio';
  const required = MIN_COINS_TO_CALL[type];
  const caller = await User.findById(callerId).select('coins role');

  if (!caller) return { canCall: false, balance: 0, required };

  return {
    canCall: caller.coins >= required,
    balance: caller.coins,
    required
  };
}

/**
 * Determine whether this call pair requires coin billing.
 * Billing only applies: caller.role === 'user' AND receiver.role === 'host'
 */
async function isBillableCall(callerId, receiverId) {
  const [caller, receiver] = await Promise.all([
    User.findById(callerId).select('role'),
    User.findById(receiverId).select('role')
  ]);

  if (!caller || !receiver) return false;
  return caller.role === 'user' && receiver.role === 'host';
}

/**
 * Deduct the one-time connection fee from the caller and credit the host.
 * Wrapped in a MongoDB transaction — either both succeed or neither does.
 */
async function deductConnectionFee(callerId, receiverId, callType, callId) {
  const type = callType === 'video' ? 'video' : 'audio';
  const fee = COIN_RATES[type].connectionFee;

  const session = await mongoose.startSession();
  let callerNewBalance;

  try {
    session.startTransaction();

    const updatedCaller = await _recordTransaction(
      session,
      callerId,
      -fee,
      'connection_fee_debit',
      {
        description: `${type} call connection fee`,
        callId,
        relatedUserId: receiverId
      }
    );

    await _recordTransaction(
      session,
      receiverId,
      +fee,
      'connection_fee_credit',
      {
        description: `${type} call connection earnings`,
        callId,
        relatedUserId: callerId
      }
    );

    await session.commitTransaction();
    callerNewBalance = updatedCaller.coins;

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  return { callerNewBalance };
}

/**
 * Start the server-side per-minute billing using recursive setTimeout.
 * Prevents billing tick overlaps if a DB call takes longer than 60 s.
 */
function startPerMinuteBilling(io, callId, callerId, receiverId, callType) {
  const key = String(callId);
  const type = callType === 'video' ? 'video' : 'audio';
  const rate = COIN_RATES[type].perMinute;

  // Initialise entry before first tick fires
  activeBillingTimers.set(key, {
    timeoutId: null,
    callerId,
    receiverId,
    callType: type,
    minutesElapsed: 0
  });

  async function billingTick() {
    console.log('[coinBilling] billingTick START');
    console.log({ callId });
    const entry = activeBillingTimers.get(key);
    if (!entry) return; // Billing was stopped before this tick ran

    entry.minutesElapsed += 1;
    const { minutesElapsed } = entry;

    // ── Pre-check balance without a transaction (fast path) ──────────────
    const caller = await User.findById(callerId).select('coins').lean();

    if (!caller || caller.coins < rate) {
      _stopAndEndCall(io, callId, callerId, receiverId, 'Insufficient coins to continue the call.');
      return;
    }

    // ── Atomic deduct + credit ────────────────────────────────────────────
    const session = await mongoose.startSession();
    let newBalance;

    try {
      session.startTransaction();

      const updatedCaller = await _recordTransaction(
        session,
        callerId,
        -rate,
        'per_minute_debit',
        {
          description: `${type} call — minute ${minutesElapsed}`,
          callId,
          relatedUserId: receiverId
        }
      );

      await _recordTransaction(
        session,
        receiverId,
        +rate,
        'per_minute_credit',
        {
          description: `${type} call earnings — minute ${minutesElapsed}`,
          callId,
          relatedUserId: callerId
        }
      );

      await session.commitTransaction();
      newBalance = updatedCaller.coins;

    } catch (err) {
      await session.abortTransaction();
      console.error('[coinBilling] Per-minute transaction failed:', err.message);
      _stopAndEndCall(io, callId, callerId, receiverId, 'Billing error. Call ended.');
      return;
    } finally {
      session.endSession();
    }

    // ── Emit events ───────────────────────────────────────────────────────
    io.to(callerId).emit('coins_deducted', {
      callId,
      coinsDeducted: rate,
      newBalance,
      minutesElapsed,
      callType: type
    });

    io.to(receiverId).emit('coins_credited', {
      callId,
      coinsEarned: rate,
      minutesElapsed,
      callType: type
    });

    // Warn if caller cannot afford the NEXT minute
    if (newBalance < rate) {
      io.to(callerId).emit('coin_warning', {
        callId,
        message: 'You are running low on coins. The call will end soon.',
        newBalance,
        coinsNeeded: rate
      });
      setTimeout(() => {
        _stopAndEndCall(
          io,
          callId,
          callerId,
          receiverId,
          'Insufficient coins to continue the call.'
        );
      }, 3000);

      return;
    }

    // ── Schedule next tick only AFTER this one completes (no overlap) ─────
    const currentEntry = activeBillingTimers.get(key);
    if (currentEntry) {
      currentEntry.timeoutId = setTimeout(billingTick, 60 * 1000);
    }
  }

  // Schedule the first tick
  const firstId = setTimeout(billingTick, 60 * 1000);
  const entry = activeBillingTimers.get(key);
  if (entry) entry.timeoutId = firstId;
}

// Stop the billing timeout for a call (called on end / reject / disconnect).
function stopBilling(callId) {
  console.log('[coinBilling] stopBilling CALLED');
  console.log({
    callId
  });
  const key = String(callId);
  const entry = activeBillingTimers.get(key);
  if (entry) {
    clearTimeout(entry.timeoutId);
    activeBillingTimers.delete(key);
  }
}

/**
 * Server Restart Recovery.
 * On startup, marks any orphaned 'ringing' or 'connected' calls as resolved.
 * This prevents ghost records building up in the DB across server restarts.
 */
async function recoverActiveCalls() {
  try {
    const CallLog = require('../src/models/callLog.model');

    const result = await CallLog.updateMany(
      { status: { $in: ['ringing', 'connected'] } },
      { $set: { status: 'interrupted', endedAt: new Date() } }
    );

    if (result.modifiedCount > 0) {
      console.log(
        `[coinBilling] Server restart: resolved ${result.modifiedCount} orphaned call(s).`
      );
    }
  } catch (err) {
    console.error('[coinBilling] Failed to recover active calls on startup:', err.message);
  }
}

// ─── Internal ──────────────────────────────────────────────────────────────────

// Stop billing and notify both parties that the call ended due to low balance.
function _stopAndEndCall(io, callId, callerId, receiverId, reason) {
  stopBilling(callId);

  io.to(callerId).emit('call_ended_low_balance', { callId, reason });
  io.to(receiverId).emit('call_ended', { senderId: callerId, callId, reason });

  console.log(`[coinBilling] Call ${callId} force-ended — ${reason}`);
}

module.exports = {
  COIN_RATES,
  MIN_COINS_TO_CALL,
  checkCanCall,
  isBillableCall,
  deductConnectionFee,
  startPerMinuteBilling,
  stopBilling,
  recoverActiveCalls
};
