const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: null },
    phone: { type: String, unique: true, sparse: true },
    email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    googleId: { type: String, default: null },
    avatar: { type: String, default: null },
    role: { type: String, enum: ['user', 'host'], default: 'user' },
    firebaseUid: { type: String, default: null },
    isPhoneVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    bio: { type: String, default: null },
    interests: { type: [String], default: [] },
    city: { type: String, default: null },
    state: { type: String, default: null },
    country: { type: String, default: null },
    age: { type: Number, default: null },
    occupation: { type: String, default: null },
    coins: { type: Number, default: 100, min: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);