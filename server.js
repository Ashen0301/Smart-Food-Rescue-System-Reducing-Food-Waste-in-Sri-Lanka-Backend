import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import listingRoutes from './routes/listing.routes.js';
import orderRoutes from './routes/order.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import discoveryRoutes from './routes/discovery.routes.js';
import adminRoutes from './routes/admin.routes.js';
import reviewRoutes from './routes/review.routes.js';
import aiRoutes from './routes/ai.routes.js';
import ngoRoutes from './routes/ngo.routes.js';
import ngoRequestRoutes from './routes/ngoRequest.routes.js';
import gamificationRoutes from './routes/gamification.routes.js';
import startExpiryService from './services/expiryService.js';
import startReservationService from './services/reservationService.js';

// Load Environment Variables
dotenv.config();

// Connect to MongoDB Atlas
connectDB();

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO Server for real-time notifications
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Socket connection handling
io.on('connection', (socket) => {
  // Join user room for targeted notifications
  socket.on('join_user_room', (userId) => {
    if (userId) {
      socket.join(userId);
      console.log(`🔌 Socket client joined user room: ${userId}`);
    }
  });

  socket.on('disconnect', () => {
    // Client disconnected
  });
});

// Attach Socket.IO instance to app for controller access
app.set('io', io);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // Allow base64 image uploads

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/listings', listingRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/discovery', discoveryRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/ngo', ngoRoutes);
app.use('/api/v1/ngo-requests', ngoRequestRoutes);
app.use('/api/v1/gamification', gamificationRoutes);

// Health Check Endpoint
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'FoodSave LK Backend API & Real-time Socket.IO are running successfully',
    timestamp: new Date().toISOString(),
  });
});

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API Endpoint Not Found',
  });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`🚀 FoodSave LK Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`📡 Socket.IO Real-Time Notification Server is ACTIVE`);
  // Initialize background automatic listing expiration & reservation cancellation runners
  startExpiryService();
  startReservationService();
});
