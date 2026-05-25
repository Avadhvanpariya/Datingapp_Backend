const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../public/uploads/posts');

    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user ? req.user.id : 'anonymous';
    // Clean original name to prevent path traversals and extract safe filename
    const cleanOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `post-${userId}-${uniqueSuffix}-${cleanOriginalName}`);
  }
});

const postUpload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB Limit
  }
});

module.exports = postUpload;
