const mongoose = require('mongoose');
const {
  checkCanCall,
  isBillableCall,
  deductConnectionFee,
  startPerMinuteBilling,
  stopBilling
} = require('./coinBilling');

// In-memory active call tracking { callId -> { callerId, receiverId, callType, billable } }
const activeCalls = new Map();

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if this user is already in an active call (as caller or receiver). */
function _isUserInActiveCall(userId) {
  for (const data of activeCalls.values()) {
    if (data.callerId === userId || data.receiverId === userId) return true;
  }
  return false;
}

/** Validates a string as a MongoDB ObjectId. */
function _isValidObjectId(id) {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}



module.exports = function registerCallSocket(io, socket) {

  // ─── Initiate Call ──────────────────────────────────────────────────────────
  // Pre-flight: validate IDs, prevent duplicate calls, check coins (user→host).
  socket.on('initiate_call', async ({ recipientId, signalData, callerName, callerAvatar, callType }, callback) => {
    const callerId = socket.user.id;
    console.log(`[callSocket] initiate_call: ${callerId} → ${recipientId} (${callType})`);

    // ── Validate recipientId ──────────────────────────────────────────────
    if (!_isValidObjectId(recipientId)) {
      const err = { success: false, error: 'invalid_id', message: 'Invalid recipient ID.' };
      if (callback) callback(err);
      socket.emit('call_error', err);
      return;
    }

    // ── Prevent calling yourself ──────────────────────────────────────────
    if (recipientId === callerId) {
      const err = { success: false, error: 'self_call', message: 'You cannot call yourself.' };
      if (callback) callback(err);
      socket.emit('call_error', err);
      return;
    }

    // ── Prevent duplicate calls ───────────────────────────────────────────
    if (_isUserInActiveCall(callerId)) {
      const err = { success: false, error: 'already_in_call', message: 'You are already in an active call.' };
      if (callback) callback(err);
      socket.emit('call_error', err);
      return;
    }

    try {
      const type = callType === 'video' ? 'video' : 'audio';

      // ── Coin pre-flight (user→host only) ─────────────────────────────────
      const billable = await isBillableCall(callerId, recipientId);
      // console.log('[initiate_call] billable result:', billable);
      // console.log('[initiate_call] caller:', callerId);
      // console.log('[initiate_call] receiver:', recipientId);

      if (billable) {
        const { canCall, balance, required } = await checkCanCall(callerId, type);
        if (!canCall) {
          const err = {
            success: false,
            error: 'insufficient_coins',
            message: `You need at least ${required} coins to start a ${type} call. Your balance: ${balance}.`,
            balance,
            required
          };
          if (callback) callback(err);
          socket.emit('call_error', err);
          return;
        }
      }

      // ── Create call log ───────────────────────────────────────────────────
      const CallLog = require('../src/models/callLog.model');
      const callLog = await CallLog.create({
        callType: type,
        caller: callerId,
        receiver: recipientId,
        status: 'ringing',
        createdAt: new Date()
      });

      const callIdStr = callLog._id.toString();

      // Track active call before emitting to recipient
      activeCalls.set(callIdStr, {
        callerId,
        receiverId: recipientId,
        callType: type,
        billable
      });

      // ── Notify recipient ──────────────────────────────────────────────────
      io.to(recipientId).emit('incoming_call', {
        callerId,
        callerName: callerName || 'Matched User',
        callerAvatar: callerAvatar || null,
        signalData,
        callId: callLog._id,
        callType: type
      });

      if (callback) callback({ success: true, callId: callLog._id });

    } catch (err) {
      console.error('[callSocket] initiate_call error:', err.message);
      if (callback) callback({ success: false, error: 'server_error', message: err.message });
    }
  });

  // ─── Accept Call ────────────────────────────────────────────────────────────
  // Auth check
  // Then deduct connection fee and start per-minute billing for billable calls.
  socket.on('accept_call', async ({ callerId, signalData, callId }) => {
    console.log(`[callSocket] accept_call: callId=${callId} by ${socket.user.id}`);

    // ── Validate callId ───────────────────────────────────────────────────
    if (!_isValidObjectId(callId) || !_isValidObjectId(callerId)) {
      console.warn(`[callSocket] accept_call rejected — invalid IDs (callId=${callId})`);
      return;
    }

    try {
      const CallLog = require('../src/models/callLog.model');
      const callLog = await CallLog.findById(callId);

      if (!callLog) {
        console.warn(`[callSocket] accept_call — CallLog ${callId} not found.`);
        return;
      }

      // ── Authorization: only the actual receiver may accept ─────────────
      if (callLog.receiver.toString() !== socket.user.id) {
        console.warn(
          `[callSocket] Unauthorized accept_call by ${socket.user.id} (expected receiver: ${callLog.receiver})`
        );
        return;
      }

      // ── Update call log to connected ──────────────────────────────────────
      const updatedCall = await CallLog.findByIdAndUpdate(
        callId,
        { status: 'connected', acceptedAt: new Date() },
        { new: true }
      )
        .populate('caller', 'name avatar')
        .populate('receiver', 'name avatar');

      if (updatedCall) {
        io.to(callerId).emit('call_updated', updatedCall);
        io.to(socket.user.id).emit('call_updated', updatedCall);
      }

      // ── Coin billing ──────────────────────────────────────────────────────
      const callEntry = activeCalls.get(String(callId));
      // console.log('[accept_call] callEntry:', callEntry);
      // console.log('[accept_call] billable:', callEntry?.billable);
      if (callEntry && callEntry.billable) {
        try {
          const { callerNewBalance } = await deductConnectionFee(
            callerId,
            socket.user.id,
            callEntry.callType,
            callId
          );

          const connectionFee = callEntry.callType === 'video' ? 5 : 2;

          io.to(callerId).emit('coins_deducted', {
            callId,
            coinsDeducted: connectionFee,
            newBalance: callerNewBalance,
            reason: 'connection_fee',
            callType: callEntry.callType
          });
          // console.log('[accept_call] deductConnectionFee SUCCESS');
          // console.log({ callerNewBalance });

          io.to(socket.user.id).emit('coins_credited', {
            callId,
            coinsEarned: connectionFee,
            reason: 'connection_fee',
            callType: callEntry.callType
          });

          // Start per-minute billing
          // console.log('[accept_call] CALLING startPerMinuteBilling');
          startPerMinuteBilling(io, callId, callerId, socket.user.id, callEntry.callType);
          // console.log('[accept_call] startPerMinuteBilling SUCCESS');

        } catch (billingErr) {
          console.error('[callSocket] Connection fee failed FULL ERROR:');
          console.error(billingErr);

          // Could not process fee — terminate call immediately
          socket.emit('call_ended', { senderId: callerId, callId, reason: 'billing_error' });
          io.to(callerId).emit('call_ended_low_balance', {
            callId,
            reason: 'Could not process connection fee. Insufficient coins.'
          });

          activeCalls.delete(String(callId));
          return;
        }
      }

    } catch (err) {
      console.error('[callSocket] accept_call error:', err.message);
    }

    // Relay WebRTC answer signal to caller
    io.to(callerId).emit('call_accepted', {
      receiverId: socket.user.id,
      signalData,
      callId
    });
  });

  // ─── Reject Call ────────────────────────────────────────────────────────────
  socket.on('reject_call', async ({ callerId, callId }) => {
    console.log(`[callSocket] reject_call: callId=${callId} by ${socket.user.id}`);

    if (!_isValidObjectId(callId)) {
      console.warn('[callSocket] reject_call — invalid callId');
      return;
    }

    try {
      const CallLog = require('../src/models/callLog.model');
      await CallLog.findByIdAndUpdate(callId, {
        status: 'rejected',
        endedAt: new Date()
      });
    } catch (err) {
      console.error('[callSocket] reject_call DB error:', err.message);
    }

    stopBilling(callId);
    activeCalls.delete(String(callId));

    io.to(callerId).emit('call_rejected', {
      receiverId: socket.user.id,
      callId
    });
  });

  // ─── End Call / Hang Up ─────────────────────────────────────────────────────
  socket.on('end_call', async ({ targetId, callId }) => {
    console.log(`[callSocket] end_call: callId=${callId} by ${socket.user.id}`);

    if (!_isValidObjectId(callId)) {
      console.warn('[callSocket] end_call — invalid callId');
      return;
    }

    // Stop billing immediately before any async DB work
    stopBilling(callId);
    activeCalls.delete(String(callId));

    try {
      const CallLog = require('../src/models/callLog.model');
      const callLog = await CallLog.findById(callId);

      if (callLog) {
        const endedAt = new Date();
        let duration = 0;
        let status = callLog.status;

        if (callLog.status === 'connected' && callLog.acceptedAt) {
          duration = Math.round((endedAt - callLog.acceptedAt) / 1000);
          status = 'completed';
        } else if (callLog.status === 'ringing') {
          status = 'missed';
        }

        const updatedCall = await CallLog.findByIdAndUpdate(
          callId,
          { status, endedAt, duration },
          { new: true }
        )
          .populate('caller', 'name avatar')
          .populate('receiver', 'name avatar');

        if (updatedCall) {
          io.to(targetId).emit('call_updated', updatedCall);
          io.to(socket.user.id).emit('call_updated', updatedCall);
        }
      }
    } catch (err) {
      console.error('[callSocket] end_call DB error:', err.message);
    }

    io.to(targetId).emit('call_ended', {
      senderId: socket.user.id,
      callId
    });
  });

  // ─── Relay ICE Candidates ───────────────────────────────────────────────────
  socket.on('relay_ice_candidate', ({ targetId, candidate }) => {
    if (!_isValidObjectId(targetId)) return;
    io.to(targetId).emit('ice_candidate', {
      senderId: socket.user.id,
      candidate
    });
  });

  // ─── Toggle Mute / Unmute ───────────────────────────────────────────────────
  socket.on('toggle_mute', ({ targetId, isMuted }) => {
    if (!_isValidObjectId(targetId)) return;
    io.to(targetId).emit('peer_mute_status', {
      senderId: socket.user.id,
      isMuted
    });
  });

  // ─── Toggle Camera On/Off ───────────────────────────────────────────────────
  socket.on('toggle_camera', ({ recipientId, isCameraOff }) => {
    if (!_isValidObjectId(recipientId)) return;
    io.to(recipientId).emit('peer_camera_status', { isCameraOff });
  });

  // ─── Disconnect Cleanup ─────────────────────────────────────────────────────
  socket.on('disconnect', async (reason) => {
    // Give client time to reconnect
    setTimeout(async () => {
      // Check if same user already reconnected
      const stillConnected = [...io.sockets.sockets.values()].some(
        (s) => s.user?.id === socket.user.id
      );

      if (stillConnected) {
        // console.log('[callSocket] user reconnected, skipping cleanup');
        return;
      }

      try {
        const CallLog = require('../src/models/callLog.model');
        for (const [callId, callData] of activeCalls.entries()) {
          if (
            callData.callerId !== socket.user.id &&
            callData.receiverId !== socket.user.id
          ) {
            continue;
          }

          const targetId = callData.callerId === socket.user.id ? callData.receiverId : callData.callerId;

          stopBilling(callId);

          await CallLog.findByIdAndUpdate(callId, { status: 'completed', endedAt: new Date() });

          io.to(targetId).emit('call_ended', { senderId: socket.user.id, callId });

          activeCalls.delete(callId);
        }

      } catch (err) {
        console.error('[callSocket] disconnect cleanup error:', err.message);
      }

    }, 15000); // 15 second reconnect grace period
  });

};