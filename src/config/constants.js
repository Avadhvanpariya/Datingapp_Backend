// Application-wide const

const ROLES = {
  USER: 'user',
  HOST: 'host',
};

const STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
};

const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
};

module.exports = { ROLES, STATUS, PAGINATION };
