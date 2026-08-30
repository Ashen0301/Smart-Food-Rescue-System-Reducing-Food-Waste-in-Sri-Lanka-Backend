import mongoose from 'mongoose';

let isConnected = false;

export const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is missing from environment variables');
    throw new Error('MONGODB_URI environment variable is missing');
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
    });
    isConnected = true;
    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Atlas Connection Error: ${error.message}`);
    // Never call process.exit(1) in serverless environments
    throw error;
  }
};

export default connectDB;
