// src/controllers/authController.js
const pool = require('../../config/db');
const bcrypt = require('bcrypt');

// Show login page
exports.getLogin = (req, res) => {
  res.render('auth/login', { title: 'Login' });
};

// Show register page
exports.getRegister = (req, res) => {
  res.render('auth/register', { title: 'Register' });
};

// Handle registration
exports.postRegister = async (req, res) => {
  const { name, email, password, confirm_password } = req.body;

  if (!name || !email || !password || !confirm_password) {
    req.flash('error_msg', 'Please fill in all fields');
    return res.redirect('/auth/register');
  }

  if (password !== confirm_password) {
    req.flash('error_msg', 'Passwords do not match');
    return res.redirect('/auth/register');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Note: A default 'role' of 'customer' should be set here or in the SQL schema default.
    await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3)',
      [name, email, hashedPassword]
    );

    req.flash('success_msg', 'You are now registered! Please login.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error(err.message);
    req.flash('error_msg', 'Email already exists');
    res.redirect('/auth/register');
  }
};

// Handle login (UPDATED LOGIC HERE)
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    req.flash('error_msg', 'Please enter all fields');
    return res.redirect('/auth/login');
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (result.rows.length === 0) {
      req.flash('error_msg', 'Invalid credentials');
      return res.redirect('/auth/login');
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      req.flash('error_msg', 'Invalid credentials');
      return res.redirect('/auth/login');
    }

    // Set session (role is fetched from the DB)
    req.session.user = { id: user.user_id, name: user.name, email: user.email, role: user.role };
    req.flash('success_msg', `Welcome ${user.name}!`);

    // --- CONDITIONAL REDIRECT LOGIC ADDED ---
    if (user.role === 'admin') {
      res.redirect('/admin/dashboard'); // Redirect admin users to the dashboard
    } else {
      res.redirect('/'); // Redirect customers to the homepage
    }
    // ----------------------------------------

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// Logout
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error(err);
    res.redirect('/auth/login');
  });
};