// src/middlewares/adminMiddleware.js
exports.ensureAdmin = (req, res, next) => {
  // 1. Check if user is logged in
  if (!req.session.user) {
    req.flash('error_msg', 'Please login as an Admin to access this page.');
    return res.redirect('/auth/login');
  }

  // 2. Check if the user has the 'admin' role
  // NOTE: This assumes your user object stored in the session has a 'role' property.
  // The role check in authController.js will need to be configured to pull the role.
  if (req.session.user.role !== 'admin') {
    req.flash('error_msg', 'Access denied. You do not have administrator privileges.');
    return res.status(403).redirect('/');
  }

  // If authenticated and is admin, proceed
  next();
};