const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const flash = require('connect-flash');
require('dotenv').config();

const pool = require('./config/db'); // PostgreSQL connection

const app = express();
const PORT = process.env.PORT || 3000;

// -----------------------------
// Middleware
// -----------------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// -----------------------------
// EJS setup
// -----------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// -----------------------------
// Sessions
// -----------------------------
app.use(
  session({
    store: new pgSession({
      pool: pool,                 // PostgreSQL pool
      tableName: 'session',       // Table to store sessions
    }),
    secret: process.env.SESSION_SECRET || 'mysecret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
  })
);

// -----------------------------
// Flash messages
// -----------------------------
app.use(flash());
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.user = req.session.user || null;
  next();
});

// -----------------------------
// Routes
// -----------------------------
app.get('/', (req, res) => {
  res.render('pages/home', { title: 'Home' });
});

// Auth route
const authRoutes = require('./src/routes/authRoutes');
app.use('/auth', authRoutes);

// Product routes
const productRoutes = require('./src/routes/productRoutes');
app.use('/products', productRoutes);

// Cart routes
const cartRoutes = require('./src/routes/cartRoutes');
app.use('/cart', cartRoutes);

// Order routes
const orderRoutes = require('./src/routes/orderRoutes');
app.use('/orders', orderRoutes);

// Admin routes 
const adminRoutes = require('./src/routes/adminRoutes');
app.use('/admin', adminRoutes);

// 404 Error page
app.use((req, res, next) => {
  res.status(404).render('error', { message: 'Page Not Found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { message: 'Something Went Wrong!' });
});

// -----------------------------
// Start server
// -----------------------------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});