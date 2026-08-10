import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false,
    },
    role: {
      type: String,
      enum: ['CONSUMER', 'VENDOR', 'NGO', 'ADMIN'],
      default: 'CONSUMER',
    },
    phone: {
      type: String,
      trim: true,
    },
    outletName: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    district: {
      type: String,
      default: 'Colombo',
    },
    isVerified: {
      type: Boolean,
      default: function () {
        return this.role !== 'VENDOR'; // Vendors require Admin verification before posting listings
      },
    },
    verifiedAt: {
      type: Date,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reliabilityScore: {
      type: Number,
      default: 100,
    },
    // User Management Module: Notification Settings & Preferences
    notificationPreferences: {
      emailAlerts: { type: Boolean, default: true },
      proximityAlerts: { type: Boolean, default: true },
      preferredCategories: [{ type: String }],
      maxRadiusKm: { type: Number, default: 5 },
      dailyAlertLimit: { type: Number, default: 10 },
    },
    // Dietary Preferences for Consumers
    dietaryPreferences: [{ type: String }],
  },
  { timestamps: true }
);

// Hash password before saving to MongoDB Atlas
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password entered by user with hashed password in database
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
