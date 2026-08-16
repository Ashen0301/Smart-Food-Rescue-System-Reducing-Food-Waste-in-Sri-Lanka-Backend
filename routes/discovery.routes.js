import express from 'express';
import {
  getNearbyConsumerListings,
  getConsumerPreferences,
  updateConsumerPreferences,
  updateSubscribedCategories,
  getConsumerNotifications,
  markConsumerNotificationRead,
  markAllConsumerNotificationsRead,
  deleteConsumerNotification,
} from '../controllers/discovery.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Consumer Discovery & Preferences Routes (Protected)
router.get('/listings', protect, getNearbyConsumerListings);
router.get('/preferences', protect, getConsumerPreferences);
router.put('/preferences', protect, updateConsumerPreferences);
router.put('/subscriptions', protect, updateSubscribedCategories);

// Consumer Notification Center Routes
router.get('/notifications', protect, getConsumerNotifications);
router.put('/notifications/read-all', protect, markAllConsumerNotificationsRead);
router.put('/notifications/read/:id', protect, markConsumerNotificationRead);
router.delete('/notifications/:id', protect, deleteConsumerNotification);

export default router;
