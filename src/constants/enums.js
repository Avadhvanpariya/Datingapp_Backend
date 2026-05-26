const USER_ROLES = {
    USER: 'user',
    HOST: 'host'
};

const CALL_TYPES = {
    AUDIO: 'audio',
    VIDEO: 'video'
};

const CALL_STATUS = {
    RINGING: 'ringing',
    MISSED: 'missed',
    REJECTED: 'rejected',
    CONNECTED: 'connected',
    COMPLETED: 'completed',
    INTERRUPTED: 'interrupted'
};

const SWIPE_TYPES = {
    LIKE: 'like',
    PASS: 'pass',
    SUPERLIKE: 'superlike'
};

const TRANSACTION_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

const TRANSACTION_TYPES = {
    PURCHASE: 'purchase',

    CONNECTION_FEE_DEBIT: 'connection_fee_debit',
    CONNECTION_FEE_CREDIT: 'connection_fee_credit',

    PER_MINUTE_DEBIT: 'per_minute_debit',
    PER_MINUTE_CREDIT: 'per_minute_credit',

    REFUND: 'refund'
};

module.exports = {
    USER_ROLES,
    CALL_TYPES,
    CALL_STATUS,
    SWIPE_TYPES,
    TRANSACTION_STATUS,
    TRANSACTION_TYPES
};