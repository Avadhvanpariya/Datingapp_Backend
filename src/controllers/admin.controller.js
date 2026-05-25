// Placeholder controllers — add logic when building each feature

const asyncHandler = require('../../utils/asyncHandler');

const getAllAdmins = asyncHandler(async (req, res) => {
  res.status(200).json({ status: 'success', data: [] });
});

module.exports = { getAllAdmins };
