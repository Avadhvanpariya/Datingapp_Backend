const mongoose = require('mongoose');
const { CALL_TYPES, CALL_STATUS } = require('../constants/enums');

const callLogSchema = new mongoose.Schema({
  caller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  callType: { type: String, enum: Object.values(CALL_TYPES), required: true },
  status: { type: String, enum: Object.values(CALL_STATUS), default: 'missed' },
  startedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  duration: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Index to retrieve call log history involving a specific user sorted by date
callLogSchema.index({ caller: 1, createdAt: -1 });
callLogSchema.index({ receiver: 1, createdAt: -1 });

module.exports = mongoose.model('CallLog', callLogSchema);
