// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { ensureAdmin } = require('../middlewares/adminMiddleware'); // New middleware

// All admin routes are protected by ensureAdmin
// Dashboard / Main Admin View
router.get('/dashboard', ensureAdmin, adminController.getDashboard);

// Product Management
router.get('/products', ensureAdmin, adminController.getProducts); // View all products (Admin List)
router.get('/products/add', ensureAdmin, adminController.getAddProduct); // Show add form
router.post('/products/add', ensureAdmin, adminController.postAddProduct); // Handle add form submission
router.get('/products/edit/:id', ensureAdmin, adminController.getEditProduct); // Show edit form
router.post('/products/edit/:id', ensureAdmin, adminController.postEditProduct); // Handle edit form submission
router.post('/products/delete/:id', ensureAdmin, adminController.deleteProduct); // Delete product

// Order Management (Basic)
router.get('/orders', ensureAdmin, adminController.getOrders); // View all orders

module.exports = router;