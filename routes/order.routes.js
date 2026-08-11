import express from 'express';
import { createOrder, getVendorOrders, updateOrderStatus } from '../controllers/order.controller.js';
import { protect, authorizeRoles } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/', protect, createOrder);
router.get('/vendor/me', protect, authorizeRoles('VENDOR', 'ADMIN'), getVendorOrders);
router.put('/:id/status', protect, authorizeRoles('VENDOR', 'ADMIN'), updateOrderStatus);

export default router;
