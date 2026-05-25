function getPagination(req, defaultLimit = 15) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, parseInt(req.query.limit, 10) || defaultLimit);
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip
  };
}

module.exports = {
  getPagination
};
