const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const User = require('../models/user.model');
const Swipe = require('../models/swipe.model');
const AppError = require('../../utils/AppError');
const asyncHandler = require('../../utils/asyncHandler');
const admin = require('../config/firebase');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const sendTokenResponse = (res, user, statusCode = 200) => {
  const token = signToken({ id: user._id, role: user.role });

  // Profile is complete only if name, email, phone, and role are set
  const needsProfileCompletion = !user.phone || !user.email || !user.name;

  res.status(statusCode).json({
    success: true,
    message: 'Login successful',
    token,
    needsProfileCompletion,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone,
      coins: user.coins,
    },
  });
};

// ─── Google Login ─────────────────────────────────────────────────────────────
const googleLogin = asyncHandler(async (req, res, next) => {
  const { idToken } = req.body;

  if (!idToken) {
    return next(new AppError('Google ID token is required.', 400));
  }

  // Verify token with Google
  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch {
    return next(new AppError('Invalid Google token.', 401));
  }

  const { sub: googleId, email, name, picture } = ticket.getPayload();

  // Find existing user or create new one
  let user = await User.findOne({ $or: [{ googleId }, { email }] });

  if (user) {
    // If user exists via email but never logged in with Google before
    if (!user.googleId) {
      user.googleId = googleId;
      user.avatar = user.avatar || picture;
      await user.save();
    }
  } else {
    user = await User.create({
      name,
      email,
      googleId,
      avatar: picture,
    });
  }

  sendTokenResponse(res, user, 200);
});

// --- phone otp login ----------------
const phoneLogin = asyncHandler(async (req, res, next) => {
  const { firebaseToken, name, role } = req.body;

  if (!firebaseToken) {
    return next(
      new AppError('Firebase token is required.', 400)
    );
  }

  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(firebaseToken);
  } catch {
    return next(
      new AppError('Invalid Firebase token.', 401)
    );
  }

  const { uid, phone_number } = decodedToken;
  const cleanPhone = phone_number.replace(/[^\d]/g, '');
  const last10 = cleanPhone.slice(-10);

  // Search by firebaseUid, exact phone, or by matching the last 10 digits
  let user = await User.findOne({
    $or: [
      { firebaseUid: uid },
      { phone: phone_number },
      { phone: { $regex: last10 + '$' } }
    ]
  });

  if (user) {
    // If user exists Google login but isn't linked to phone credentials yet
    let needsSave = false;
    if (!user.firebaseUid) {
      user.firebaseUid = uid;
      needsSave = true;
    }
    if (!user.isPhoneVerified) {
      user.isPhoneVerified = true;
      needsSave = true;
    }
    // Standardize phone number format in DB
    if (user.phone !== phone_number) {
      user.phone = phone_number;
      needsSave = true;
    }
    if (needsSave) {
      await user.save();
    }
  } else {
    // Brand new user registration via Phone
    user = await User.create({
      phone: phone_number,
      firebaseUid: uid,
      isPhoneVerified: true,
      name: name || null,
      role: role || 'user'
    });
  }

  sendTokenResponse(res, user, 200);
});

// ─── Complete Profile ─────────────────────────────────────────────────────────
const completeProfile = asyncHandler(async (req, res, next) => {
  const { name, email, phone, role, bio, interests, city, state, country, age, occupation, avatarBase64 } = req.body;
  const userId = req.user.id;

  let user = await User.findById(userId);
  if (!user) {
    return next(new AppError('User not found.', 404));
  }

  // 1. Validate email is not in use by another user
  if (email && email.toLowerCase() !== (user.email || '').toLowerCase()) {
    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return next(new AppError('This email is already associated with another account.', 400));
    }
    user.email = email.toLowerCase();
  }

  // 2. Validate phone is not in use by another user
  if (phone && phone !== user.phone) {
    let cleanPhone = phone.replace(/[^\d]/g, '');

    // Auto-standardize 10 digit numbers to India E.164 country code format (+91)
    if (cleanPhone.length === 10 && !phone.startsWith('+')) {
      cleanPhone = '+91' + cleanPhone;
    } else if (phone.startsWith('+')) {
      cleanPhone = '+' + cleanPhone;
    }

    const last10 = cleanPhone.slice(-10);

    const phoneExists = await User.findOne({
      _id: { $ne: userId },
      $or: [
        { phone: cleanPhone },
        { phone: { $regex: last10 + '$' } }
      ]
    });

    if (phoneExists) {
      return next(new AppError('This phone number is already associated with another account.', 400));
    }
    user.phone = cleanPhone;
  }

  // Handle Base64 Image Upload (Local Save)
  if (avatarBase64) {
    const base64Str = avatarBase64;
    const matches = base64Str.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const ext = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');

      const uploadDir = path.join(__dirname, '../../public/uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `avatar-${userId}-${Date.now()}.${ext}`;
      const filepath = path.join(uploadDir, filename);

      fs.writeFileSync(filepath, buffer);

      // Save relative path inside database
      user.avatar = `/uploads/${filename}`;
    }
  }

  // 3. Update profile fields
  if (name) user.name = name;
  if (role) user.role = role;
  if (bio !== undefined) user.bio = bio;
  if (interests !== undefined) user.interests = interests;
  if (city !== undefined) user.city = city;
  if (state !== undefined) user.state = state;
  if (country !== undefined) user.country = country;
  if (age !== undefined) user.age = Number(age) || null;
  if (occupation !== undefined) user.occupation = occupation;

  await user.save();

  // Return updated user token response
  sendTokenResponse(res, user, 200);
});

// ─── Get Me (Current User) ───────────────────────────────────────────────────
const getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError('User not found.', 404));
  }

  const needsProfileCompletion = !user.phone || !user.email || !user.name;

  res.status(200).json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone,
      bio: user.bio,
      interests: user.interests || [],
      city: user.city,
      state: user.state,
      country: user.country,
      age: user.age,
      occupation: user.occupation,
      coins: user.coins,
    },
    needsProfileCompletion,
  });
});

// ─── Get User Stats ──────────────────────────────────────────────────────────
const getUserStats = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  const [likesCount, matchesCount, sparksCount] = await Promise.all([
    Swipe.countDocuments({ liker: userId, type: 'like' }),
    Swipe.countDocuments({ liker: userId, isMatch: true }),
    Swipe.countDocuments({ liker: userId, type: 'superlike' })
  ]);

  res.status(200).json({
    likesCount,
    matchesCount,
    sparksCount
  });
});

module.exports = { googleLogin, phoneLogin, completeProfile, getMe, getUserStats };
