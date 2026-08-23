import express from 'express';
import {
  createOrder,
  getCustomerOrders,
  getVendorOrders,
  updateOrderStatus,
  verifyCollectionPinOrQr,
  cancelConsumerOrder,
  joinWaitlist,
} from '../controllers/order.controller.js';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/', protect, createOrder);
router.get('/consumer/me', protect, getCustomerOrders);
router.get('/vendor/me', protect, authorizeRoles('VENDOR', 'ADMIN'), getVendorOrders);
router.post('/verify-pin', protect, authorizeRoles('VENDOR', 'ADMIN'), verifyCollectionPinOrQr);
router.put('/:id/cancel', protect, cancelConsumerOrder);
router.post('/waitlist', protect, joinWaitlist);
router.put('/:id/status', protect, authorizeRoles('VENDOR', 'ADMIN'), updateOrderStatus);

export default router;
