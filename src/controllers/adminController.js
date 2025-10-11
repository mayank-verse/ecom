// src/controllers/adminController.js
const pool = require('../../config/db');

// --- Dashboard ---
exports.getDashboard = (req, res) => {
    res.render('admin/dashboard', { title: 'Admin Dashboard' });
};

// --- Product Management ---

// 1. Get all products (Admin view)
exports.getProducts = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY product_id DESC');
        res.render('admin/products/index', { title: 'Manage Products', products: result.rows });
    } catch (err) {
        console.error(err.message);
        req.flash('error_msg', 'Could not load products.');
        res.status(500).redirect('/admin/dashboard');
    }
};

// 2. Show Add Product Form
exports.getAddProduct = (req, res) => {
    res.render('admin/products/add', { title: 'Add New Product' });
};

// 3. Handle Add Product Submission (FIXED INSERT QUERY)
exports.postAddProduct = async (req, res) => {
    // We still extract 'category' but ignore it in the SQL query for the fix
    const { name, description, price, image, stock, category } = req.body; 

    if (!name || !description || !price || !stock) {
        req.flash('error_msg', 'Please fill in required fields.');
        return res.redirect('/admin/products/add');
    }

    try {
        // CORRECTED: Removed 'category' column and $6 placeholder
        await pool.query(
            'INSERT INTO products (name, description, price, image, stock) VALUES ($1, $2, $3, $4, $5)',
            [name, description, parseFloat(price), image, parseInt(stock)]
        );
        req.flash('success_msg', `${name} added successfully.`);
        res.redirect('/admin/products');
    } catch (err) {
        console.error(err.message);
        req.flash('error_msg', 'Failed to add product.');
        res.status(500).redirect('/admin/products/add');
    }
};

// 4. Show Edit Product Form
exports.getEditProduct = async (req, res) => {
    const id = req.params.id;
    try {
        const result = await pool.query('SELECT * FROM products WHERE product_id=$1', [id]);
        if (result.rows.length === 0) {
            req.flash('error_msg', 'Product not found.');
            return res.status(404).redirect('/admin/products');
        }
        res.render('admin/products/edit', { title: `Edit ${result.rows[0].name}`, product: result.rows[0] });
    } catch (err) {
        console.error(err.message);
        req.flash('error_msg', 'Could not load product for editing.');
        res.status(500).redirect('/admin/products');
    }
};

// 5. Handle Edit Product Submission (CORRECTED UPDATE QUERY)
exports.postEditProduct = async (req, res) => {
    const id = req.params.id;
    // We still extract 'category' but ignore it in the SQL query for the fix
    const { name, description, price, image, stock, category } = req.body;

    if (!name || !description || !price || !stock) {
        req.flash('error_msg', 'Please fill in required fields.');
        return res.redirect(`/admin/products/edit/${id}`);
    }

    try {
        // CORRECTED: Removed 'category' from the SET clause
        await pool.query(
            'UPDATE products SET name=$1, description=$2, price=$3, image=$4, stock=$5 WHERE product_id=$6',
            [name, description, parseFloat(price), image, parseInt(stock), id]
        );
        req.flash('success_msg', `${name} updated successfully.`);
        res.redirect('/admin/products');
    } catch (err) {
        console.error(err.message);
        req.flash('error_msg', 'Failed to update product.');
        res.status(500).redirect(`/admin/products/edit/${id}`);
    }
};

// 6. Delete Product
exports.deleteProduct = async (req, res) => {
    const id = req.params.id;
    try {
        await pool.query('DELETE FROM products WHERE product_id=$1', [id]);
        req.flash('success_msg', 'Product deleted successfully.');
        res.redirect('/admin/products');
    } catch (err) {
        console.error(err.message);
        req.flash('error_msg', 'Failed to delete product.');
        res.status(500).redirect('/admin/products');
    }
};

// --- Order Management (Basic) ---
exports.getOrders = async (req, res) => {
    try {
        const ordersResult = await pool.query(
            'SELECT o.*, u.name as user_name, u.email as user_email FROM orders o JOIN users u ON o.user_id = u.user_id ORDER BY created_at DESC'
        );
        res.render('admin/orders/index', { title: 'Manage Orders', orders: ordersResult.rows });
    } catch (err) {
        console.error(err.message);
        req.flash('error_msg', 'Could not retrieve orders.');
        res.status(500).redirect('/admin/dashboard');
    }
};