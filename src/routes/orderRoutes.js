const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { ensureAuthenticated } = require('../middlewares/authMiddleware');

// Checkout page
router.get('/checkout', ensureAuthenticated, orderController.getCheckout);

// NEW ROUTE: Start the payment process (Razorpay Order creation)
router.post('/process-payment', ensureAuthenticated, orderController.processPayment);

// NEW ROUTE: Razorpay success callback route (finalize DB record)
router.post('/verify-payment', ensureAuthenticated, orderController.verifyPayment);

// Order history
router.get('/history', ensureAuthenticated, orderController.orderHistory);

module.exports = router;