const pool = require('../../config/db');
const Razorpay = require('razorpay'); 
const crypto = require('crypto');
// Load keys from environment
const { RAZORPAY_KEY, RAZORPAY_SECRET } = process.env;

const razorpay = new Razorpay({
    key_id: RAZORPAY_KEY,
    key_secret: RAZORPAY_SECRET,
});

// Utility function to handle the atomic DB operation
async function finalizeOrder(userId, paymentStatus, client) {
    try {
        // 1. Get cart items
        const cartItemsResult = await client.query(`
            SELECT c.cart_id, c.quantity, p.product_id, p.name, p.price
            FROM cart c
            JOIN products p ON c.product_id = p.product_id
            WHERE c.user_id = $1
        `, [userId]);

        if (cartItemsResult.rows.length === 0) {
            throw new Error('Cart is empty.');
        }

        // Calculate total amount (FIXED: use parseFloat)
        let totalAmount = 0;
        cartItemsResult.rows.forEach(item => totalAmount += parseFloat(item.price) * item.quantity);

        // 2. Insert into orders table
        const orderResult = await client.query(
            'INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, $3) RETURNING order_id',
            [userId, totalAmount, paymentStatus]
        );

        const orderId = orderResult.rows[0].order_id;

        // 3. Insert order items
        for (const item of cartItemsResult.rows) {
            await client.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
                [orderId, item.product_id, item.quantity, parseFloat(item.price)]
            );
        }

        // 4. Clear user's cart
        await client.query('DELETE FROM cart WHERE user_id=$1', [userId]);

        return orderId;
    } catch (error) {
        throw error;
    }
}

// Show checkout page
exports.getCheckout = async (req, res) => {
  const userId = req.session.user.id;
  try {
    const result = await pool.query(`
      SELECT c.cart_id, c.quantity, p.product_id, p.name, p.price
      FROM cart c
      JOIN products p ON c.product_id = p.product_id
      WHERE c.user_id = $1
    `, [userId]);

    // FIX: use parseFloat to calculate grandTotal correctly
    let grandTotal = 0;
    result.rows.forEach(item => grandTotal += parseFloat(item.price) * item.quantity);

    res.render('orders/checkout', { title: 'Checkout', cartItems: result.rows, grandTotal });
  } catch (err) {
    console.error(err.message);
    req.flash('error_msg', 'Could not load checkout page.');
    res.status(500).redirect('/cart');
  }
};

// Original placeOrder (COD) is now redundant but kept as a reference
// exports.placeOrder = async (req, res) => { ... }; 

// NEW LOGIC: Process Payment via Razorpay (Step 1: Create Order)
exports.processPayment = async (req, res) => {
    const userId = req.session.user.id;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const cartItemsResult = await client.query(`
            SELECT c.cart_id, c.quantity, p.product_id, p.name, p.price
            FROM cart c
            JOIN products p ON c.product_id = p.product_id
            WHERE c.user_id = $1
        `, [userId]);
        
        await client.query('COMMIT'); 

        if (cartItemsResult.rows.length === 0) {
            req.flash('error_msg', 'Your cart is empty. Cannot process payment.');
            return res.redirect('/cart');
        }

        let totalAmount = 0;
        cartItemsResult.rows.forEach(item => totalAmount += parseFloat(item.price) * item.quantity);
        
        // Razorpay amount in smallest currency unit (paise for INR)
        const amountInPaise = Math.round(totalAmount * 100); 

        // 1. Create a Razorpay Order
        const options = {
            amount: amountInPaise,
            currency: 'INR', 
            receipt: `receipt_${userId}_${Date.now()}`,
            payment_capture: 1 
        };

        const razorpayOrder = await razorpay.orders.create(options);
        
        // 2. Render the payment page
        res.render('orders/payment', { 
            title: 'Complete Payment',
            razorpayKey: RAZORPAY_KEY,
            orderId: razorpayOrder.id,
            amount: amountInPaise,
            totalAmountDisplay: totalAmount.toFixed(2),
            user: req.session.user 
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Razorpay Order Creation Error:', err.message);
        // This is where you might get 'undefined' if keys are bad.
        req.flash('error_msg', 'Failed to initiate payment. Please try again or check keys.');
        res.status(500).redirect('/orders/checkout');
    } finally {
        client.release();
    }
};

// NEW LOGIC: Handle successful payment callback (Step 2: Verify and Finalize Order in DB)
exports.verifyPayment = async (req, res) => {
    const userId = req.session.user.id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        req.flash('error_msg', 'Payment data missing.');
        return res.status(400).redirect('/orders/checkout');
    }
    
    const client = await pool.connect(); 

    try {
        // --- 1. Signature Verification (CRITICAL SECURITY STEP) ---
        const shasum = crypto.createHmac('sha256', RAZORPAY_SECRET);
        shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const digest = shasum.digest('hex');
        
        if (digest !== razorpay_signature) {
            throw new Error('Payment signature verification failed.');
        }

        // --- 2. Start Transaction and Finalize Order ---
        await client.query('BEGIN'); 
        
        // Use the refactored utility function
        const orderId = await finalizeOrder(userId, 'paid', client);

        await client.query('COMMIT'); 
        req.flash('success_msg', `Payment successful! Order #${orderId} placed successfully.`);
        res.redirect('/orders/history');

    } catch (err) {
        await client.query('ROLLBACK'); 
        console.error('Payment Verification/Finalization Error:', err.message);
        req.flash('error_msg', 'Payment successful, but order placement failed. Contact support.');
        res.status(500).redirect('/orders/checkout');
    } finally {
        client.release(); 
    }
};

// Order history
exports.orderHistory = async (req, res) => {
  const userId = req.session.user.id;
  try {
    const ordersResult = await pool.query(
      'SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC',
      [userId]
    );

    res.render('orders/order-history', { title: 'Your Orders', orders: ordersResult.rows });
  } catch (err) {
    console.error(err.message);
    req.flash('error_msg', 'Could not retrieve order history.');
    res.status(500).redirect('/');
  }
};