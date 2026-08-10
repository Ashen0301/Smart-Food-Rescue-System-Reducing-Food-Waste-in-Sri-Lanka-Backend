import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  setNotificationPreferences,
  verifyVendor,
  assignUserRole,
  getUnverifiedVendors,
  getAllUsers,
} from '../controllers/user.controller.js';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

// User self-service routes (Protected)
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.put('/preferences', protect, setNotificationPreferences);

// Admin-only management routes
router.get('/admin/unverified-vendors', protect, authorizeRoles('ADMIN'), getUnverifiedVendors);
router.put('/admin/verify-vendor/:id', protect, authorizeRoles('ADMIN'), verifyVendor);
router.put('/admin/assign-role/:id', protect, authorizeRoles('ADMIN'), assignUserRole);
router.get('/admin/all', protect, authorizeRoles('ADMIN'), getAllUsers);

export default router;
