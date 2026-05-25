const express = require('express');
const crypto = require('crypto');
const { protect } = require('../middleware/authorization/authorization');

const router = express.Router();

// Route is protected by JWT authentication
router.get('/config', protect, (req, res) => {
  try {
    const stunServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ];

    const turnSecret = process.env.TURN_SHARED_SECRET;
    const turnUrlUdp = process.env.TURN_SERVER_UDP;
    const turnUrlTcp = process.env.TURN_SERVER_TCP;

    // Fall back to static credentials if secret is not set or defaults are in place
    if (!turnSecret || !turnUrlUdp || turnUrlUdp.includes('your-domain.com')) {
      return res.json({
        iceServers: [
          ...stunServers,
          {
            urls: [
              turnUrlUdp,
              turnUrlTcp
            ],
            username: process.env.STATIC_TURN_USERNAME,
            credential: process.env.STATIC_TURN_CREDENTIAL
          }
        ]
      });
    }

    // Dynamic Time-Limited TURN credentials (using shared secret HMAC-SHA1)
    const expiry = Math.floor(Date.now() / 1000) + 24 * 3600; // valid for 24 hours
    const username = `${expiry}:${req.user.id || 'anonymous'}`;
    const hmac = crypto.createHmac('sha1', turnSecret);
    hmac.update(username);
    const credential = hmac.digest('base64');

    return res.json({
      iceServers: [
        ...stunServers,
        {
          urls: [turnUrlUdp, turnUrlTcp],
          username: username,
          credential: credential
        }
      ]
    });
  } catch (err) {
    console.error('Error generating dynamic TURN config:', err);
    return res.status(500).json({ error: 'Failed to retrieve connection configuration.' });
  }
});

// Retrieve call history for the authenticated user
router.get('/history', protect, async (req, res) => {
  try {
    const CallLog = require('../models/callLog.model');
    const logs = await CallLog.find({
      $or: [
        { caller: req.user.id },
        { receiver: req.user.id }
      ]
    })
      .populate('caller', 'name avatar')
      .populate('receiver', 'name avatar')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: logs
    });
  } catch (err) {
    console.error('Error fetching call logs:', err);
    return res.status(500).json({ error: 'Failed to retrieve call logs.' });
  }
});

module.exports = router;
