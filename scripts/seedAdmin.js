import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI is not set in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas');

    const adminEmail = 'admin@foodsave.lk';
    const adminPassword = 'adminpassword123';

    let admin = await User.findOne({ email: adminEmail });

    if (admin) {
      admin.role = 'ADMIN';
      admin.isVerified = true;
      admin.password = adminPassword;
      await admin.save();
      console.log(`👑 Admin user (${adminEmail}) updated successfully!`);
    } else {
      admin = await User.create({
        name: 'System Administrator',
        email: adminEmail,
        password: adminPassword,
        role: 'ADMIN',
        isVerified: true,
        phone: '0770000000',
        district: 'Colombo',
      });
      console.log(`🎉 New System Administrator created: ${adminEmail}`);
    }

    console.log('🔑 Login Credentials:');
    console.log(`   Email:    ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed Admin:', error);
    process.exit(1);
  }
};

seedAdmin();
