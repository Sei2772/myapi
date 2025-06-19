// ✅ Refactored version using mysql2/promise and connection pool
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

const query = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return rows;
};

app.get('/', (req, res) => {
  res.json({ msg: 'it working!' });
});

// User endpoints
app.get('/allUsers', async (req, res) => {
  try {
    const users = await query('SELECT * FROM users');
    res.send(users);
  } catch (err) {
    res.status(500).json({ error: true, message: 'Database error', details: err.message });
  }
});

app.post('/user', async (req, res) => {
  const user = req.body;
  if (!user) return res.status(400).send({ error: true, message: 'Please provide user data' });

  try {
    const result = await query('INSERT INTO users SET ?', [user]);
    res.send(result);
  } catch (err) {
    res.status(500).json({ error: true, message: 'Database error', details: err.message });
  }
});

app.put('/update/:id', async (req, res) => {
  const user_id = req.params.id;
  const user_data = req.body;

  if (!user_id || !user_data || Object.keys(user_data).length === 0) {
    return res.status(400).send({ error: true, message: 'Please provide user data' });
  }

  try {
    const result = await query('UPDATE users SET ? WHERE user_id = ?', [user_data, user_id]);
    if (result.affectedRows === 0) {
      return res.status(404).send({ error: true, message: 'User not found' });
    }
    res.send({ error: false, data: result, message: 'User updated successfully.' });
  } catch (err) {
    res.status(500).send({ error: true, message: 'Database error', details: err.message });
  }
});

app.delete('/delete/:id', async (req, res) => {
  const user_id = req.params.id;
  if (!user_id) {
    return res.status(400).send({ error: true, message: 'Please provide user ID' });
  }

  try {
    const result = await query('DELETE FROM users WHERE user_id = ?', [user_id]);
    res.send({ error: false, data: result, message: 'User deleted successfully.' });
  } catch (err) {
    res.status(500).send({ error: true, message: 'Database error', details: err.message });
  }
});

app.post('/register', async (req, res) => {
  const { user_id, user_name, password } = req.body;
  const role = 'employee';

  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const exists = await query('SELECT * FROM users WHERE user_id = ?', [user_id]);
    if (exists.length > 0) {
      return res.status(400).send({ error: true, message: 'This user ID is already in the database.' });
    }

    await query('INSERT INTO users (user_id, user_name, password, role) VALUES (?, ?, ?, ?)', [user_id, user_name, password_hash, role]);
    res.send({ success: true, message: 'User registered successfully.' });
  } catch (err) {
    res.status(500).send({ error: true, message: 'Database error', details: err.message });
  }
});

app.post('/login', async (req, res) => {
  const { user_id, password } = req.body;

  if (!user_id || !password) {
    return res.status(400).send({ error: true, message: 'Please provide user ID and password.' });
  }

  try {
    const users = await query('SELECT * FROM users WHERE user_id = ?', [user_id]);
    const user = users[0];

    if (user && await bcrypt.compare(password, user.password)) {
      return res.send({ success: true, user_id: user.user_id, role: user.role });
    } else {
      return res.send({ success: false, message: 'Incorrect user ID or password' });
    }
  } catch (err) {
    res.status(500).send({ error: true, message: 'Database error', details: err.message });
  }
});

app.get('/search/:id', async (req, res) => {
  const user_id = req.params.id;
  if (!user_id) return res.status(400).send({ error: true, message: 'Please provide user ID' });

  try {
    const results = await query('SELECT * FROM users WHERE user_id = ?', [user_id]);
    const user = results[0];
    if (!user) return res.status(404).send({ error: true, message: 'User not found' });

    res.send({ user_id: user.user_id, user_name: user.user_name, role: user.role });
  } catch (err) {
    res.status(500).send({ error: true, message: 'Database error', details: err.message });
  }
});

// ✅ /products endpoints

app.get('/search/products', async (req, res) => {
  const { keyword } = req.query;

  if (!keyword) {
    return res.status(400).json({ error: true, message: 'Missing search keyword' });
  }

  try {
    const results = await query(
      'SELECT * FROM product WHERE isDeleted = 0 AND ProductName LIKE ?',
      [`%${keyword}%`]
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: true, message: 'Database error', details: err.message });
  }
});

app.post('/products/filter', async (req, res) => {
  const { types } = req.body;

  if (!Array.isArray(types) || types.length === 0) {
    return res.status(400).json({ error: true, message: 'Invalid product type list' });
  }

  const placeholders = types.map(() => '?').join(',');
  const sql = `
    SELECT * FROM product
    WHERE ProductType_idProductType IN (${placeholders}) AND isDeleted = 0
  `;

  try {
    const results = await query(sql, types);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: true, message: 'Database error', details: err.message });
  }
});

app.post('/products', async (req, res) => {
  const { ProductName, Price_gram, quantity, ProductType_idProductType, img } = req.body;

  if (!ProductName || !Price_gram || !quantity || !ProductType_idProductType || !img) {
    return res.status(400).send({ error: true, message: 'Please provide all product details.' });
  }

  try {
    const result = await query(
      'INSERT INTO product (ProductName, Price_gram, quantity, ProductType_idProductType, img) VALUES (?, ?, ?, ?, ?)',
      [ProductName, Price_gram, quantity, ProductType_idProductType, img]
    );
    res.send({ success: true, message: 'Product added successfully.', productId: result.insertId });
  } catch (err) {
    res.status(500).send({ error: true, message: 'Database error', details: err.message });
  }
});

app.patch('/products/:id', async (req, res) => {
  const product_id = req.params.id;
  const updateData = req.body;

  if (!product_id || Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: true, message: 'กรุณาระบุข้อมูลสินค้าให้ครบถ้วน' });
  }

  try {
    const existing = await query('SELECT * FROM product WHERE idProduct = ?', [product_id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: true, message: 'ไม่พบสินค้าที่ต้องการอัปเดต' });
    }

    await query('UPDATE product SET ? WHERE idProduct = ?', [updateData, product_id]);
    res.json({ success: true, message: 'อัปเดตสินค้าสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Database error', details: err.message });
  }
});

app.put('/deleteProduct/:id', async (req, res) => {
  const id = req.params.id;

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'รหัสสินค้าที่ส่งมาไม่ถูกต้อง' });
  }

  try {
    const exists = await query('SELECT * FROM product WHERE idProduct = ?', [id]);
    if (exists.length === 0) {
      return res.status(404).json({ error: 'ไม่พบสินค้า' });
    }

    await query('UPDATE product SET isDeleted = TRUE WHERE idProduct = ?', [id]);
    res.status(200).json({ message: 'ลบสินค้าสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์', details: err.message });
  }
});

app.get('/products', async (req, res) => {
  const { ProductType_idProductType } = req.query;
  let sql = 'SELECT * FROM product WHERE isDeleted = FALSE';
  const params = [];

  if (ProductType_idProductType) {
    sql += ' AND ProductType_idProductType = ?';
    params.push(ProductType_idProductType);
  }

  try {
    const products = await query(sql, params);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: true, message: 'Database error', details: err.message });
  }
});

app.get('/products/:id', async (req, res) => {
  const productId = req.params.id;

  try {
    const result = await query('SELECT * FROM product WHERE idProduct = ?', [productId]);
    if (result.length === 0) return res.status(404).json({ message: 'ไม่พบสินค้า' });
    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: true, message: 'Database error', details: err.message });
  }
});

// ✅ /orders & /orderdetail endpoints

app.post('/neworder', async (req, res) => {
  const { user_id } = req.body;
  const newOrder = { created_at: new Date() };
  if (user_id) newOrder.user_id = user_id;

  try {
    const result = await query('INSERT INTO orders SET ?', [newOrder]);
    res.send({ success: true, message: 'New order created successfully.', order_id: result.insertId });
  } catch (err) {
    res.status(500).send({ error: true, message: 'Database error', details: err.message });
  }
});

app.get('/orders', async (req, res) => {
  try {
    const results = await query('SELECT * FROM orderdetail');
    res.send(results);
  } catch (err) {
    res.status(500).send({ error: true, message: 'Database error', details: err.message });
  }
});

app.get('/order/:id', async (req, res) => {
  const order_id = req.params.id;
  if (!order_id) return res.status(400).send({ error: true, message: 'Please provide order ID' });

  try {
    const results = await query('SELECT * FROM orderdetail WHERE order_id = ?', [order_id]);
    res.send(results);
  } catch (err) {
    res.status(500).send({ error: true, message: 'Database error', details: err.message });
  }
});

app.delete('/order/:id', async (req, res) => {
  const order_id = req.params.id;
  if (!order_id) return res.status(400).send({ error: true, message: 'Please provide order ID' });

  try {
    const result = await query('DELETE FROM orderdetail WHERE order_id = ?', [order_id]);
    if (result.affectedRows === 0) return res.status(404).send({ error: true, message: 'Order not found' });
    res.send({ success: true, message: 'Order deleted successfully.' });
  } catch (err) {
    res.status(500).send({ error: true, message: 'Database error', details: err.message });
  }
});

app.post('/orderdetail/add', async (req, res) => {
  const { order_id, product_name, product_weight, idProduct } = req.body;

  if (!order_id || !product_name || !product_weight || !idProduct) {
    return res.status(400).json({ message: 'ข้อมูลไม่ครบ' });
  }

  try {
    await query(
      'INSERT INTO orderdetail (order_id, product_name, product_weight, idProduct) VALUES (?, ?, ?, ?)',
      [order_id, product_name, product_weight, idProduct]
    );
    res.status(201).json({ message: 'เพิ่ม orderdetail สำเร็จ!' });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
  }
});

app.get('/orderdetails', async (req, res) => {
  const sql = `
    SELECT orderdetail.order_id,
           orderdetail.product_name,
           orderdetail.product_weight,
           orderdetail.product_price,
           orders.created_at
    FROM orderdetail
    JOIN orders ON orderdetail.order_id = orders.id
    WHERE orderdetail.isDelete = 0
    ORDER BY orders.created_at DESC;
  `;

  try {
    const results = await query(sql);
    res.send(results);
  } catch (err) {
    res.status(500).send({
      error: true,
      message: 'Database error',
      details: err.message
    });
  }
});
app.put('/orderdetail/update/:idProduct', async (req, res) => {
  const idProduct = req.params.idProduct;
  const { product_weight, product_price } = req.body;

  if (product_weight === undefined && product_price === undefined) {
    return res.status(400).json({ success: false, message: "กรุณาส่งข้อมูลน้ำหนักหรือราคาที่ต้องการอัพเดต" });
  }

  try {
    const fields = [];
    const values = [];

    if (product_weight !== undefined) {
      fields.push('product_weight = ?');
      values.push(product_weight);
    }
    if (product_price !== undefined) {
      fields.push('product_price = ?');
      values.push(product_price);
    }

    values.push(idProduct);

    const sql = `UPDATE orderdetail SET ${fields.join(', ')} WHERE idProduct = ? AND isDelete = 0`;

    const result = await query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลที่ต้องการแก้ไข' });
    }

    res.json({ success: true, message: 'แก้ไขข้อมูลสำเร็จ' });
  } catch (error) {
    console.error('Error updating orderdetail:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด', error: error.message });
  }
});





// ✅ /dashboard & /topproducts endpoints

app.get('/dashboard', async (req, res) => {
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM orderdetail WHERE isDelete = 0) AS total_orders,
      (SELECT COUNT(*) FROM product WHERE isDeleted = 0) AS total_products,
      (
        SELECT SUM(COALESCE(CAST(product_weight AS FLOAT), 0) * COALESCE(CAST(product_price AS FLOAT), 0))
        FROM orderdetail WHERE isDelete = 0
      ) AS total_sales
  `;

  try {
    const results = await query(sql);
    res.send(results[0]);
  } catch (err) {
    res.status(500).send({ error: true, message: 'Database error', details: err.message });
  }
});

app.get('/topproducts', async (req, res) => {
  const sql = `
    SELECT * FROM product
    WHERE isDeleted = 0
    ORDER BY quantity DESC
    LIMIT 4
  `;

  try {
    const results = await query(sql);
    res.send(results);
  } catch (err) {
    res.status(500).send({ error: true, message: 'Database error', details: err.message });
  }
});

// ✅ รายงานรายวัน รายสัปดาห์ รายเดือน

app.get('/moreDate/:day', async (req, res) => {
  const { day } = req.params;
  let sql = '';

  if (day == 7 || day == 30) {
    sql = `
      WITH RECURSIVE numbers AS (
        SELECT 0 AS n
        UNION ALL
        SELECT n + 1 FROM numbers WHERE n < ?
      )
      SELECT
        DATE(DATE_SUB(CURDATE(), INTERVAL numbers.n DAY)) AS time_group,
        COALESCE(COUNT(o.created_at), 0) AS total,
        SUM(COALESCE(CAST(orderdetail.product_weight AS FLOAT), 0) * COALESCE(CAST(orderdetail.product_price AS FLOAT), 0)) AS total_weight_price
      FROM numbers
      LEFT JOIN orders o ON DATE(o.created_at) = DATE_SUB(CURDATE(), INTERVAL numbers.n DAY)
      LEFT JOIN orderdetail ON o.id = orderdetail.order_id AND orderdetail.isdelete = 0
      GROUP BY time_group
      ORDER BY time_group DESC
      LIMIT 32;
    `;
  } else if (day == 1) {
    sql = `
      WITH RECURSIVE hours AS (
        SELECT 1 AS hour_group
        UNION ALL
        SELECT hour_group + 1 FROM hours WHERE hour_group < 24
      )
      SELECT
        hours.hour_group AS time_group,
        COALESCE(COUNT(o.created_at), 0) AS total,
        SUM(COALESCE(CAST(orderdetail.product_weight AS FLOAT), 0) * COALESCE(CAST(orderdetail.product_price AS FLOAT), 0)) AS total_weight_price
      FROM hours
      LEFT JOIN orders o ON FLOOR(TIME_FORMAT(o.created_at, '%H')) + 1 = hours.hour_group AND DATE(o.created_at) = CURDATE()
      LEFT JOIN orderdetail ON o.id = orderdetail.order_id AND orderdetail.isDelete = 0
      GROUP BY hours.hour_group
      ORDER BY hours.hour_group;
    `;
  } else {
    return res.status(400).send({ error: true, message: 'Invalid day parameter' });
  }

  try {
    const results = await query(sql, [parseInt(day)]);
    res.send(results);
  } catch (err) {
    res.status(500).send({ error: true, message: 'Database error', details: err.message });
  }
});
// ✅ รายงานแยกตามสินค้าและวันที่

app.get('/selectedDay/:pd/:date', async (req, res) => {
  const { pd, date } = req.params;
  let queryFormat = '';

  if (pd !== '0') {
    queryFormat = `
      WITH RECURSIVE hours AS (
        SELECT 1 AS hour_group
        UNION ALL
        SELECT hour_group + 1 FROM hours WHERE hour_group < 24
      )
      SELECT
        hours.hour_group AS time_group,
        COALESCE(SUM(CASE WHEN product.idProduct = ? THEN 1 ELSE 0 END), 0) AS total,
        COALESCE(SUM(CASE WHEN product.idProduct = ? THEN COALESCE(CAST(orderdetail.product_weight AS FLOAT), 0) * COALESCE(CAST(orderdetail.product_price AS FLOAT), 0) ELSE 0 END), 0) AS total_weight_price
      FROM hours
        LEFT JOIN orders o ON FLOOR(TIME_FORMAT(o.created_at, '%H')) + 1 = hours.hour_group AND DATE(o.created_at) = CAST(? AS DATE)
        LEFT JOIN orderdetail ON o.id = orderdetail.order_id AND orderdetail.isDelete = 0
        LEFT JOIN product ON product.idProduct = orderdetail.idProduct
      GROUP BY hours.hour_group
      ORDER BY hours.hour_group;
    `;
  } else {
    queryFormat = `
      WITH RECURSIVE hours AS (
        SELECT 1 AS hour_group
        UNION ALL
        SELECT hour_group + 1 FROM hours WHERE hour_group < 24
      )
      SELECT
        hours.hour_group AS time_group,
        COALESCE(COUNT(o.created_at), 0) AS total,
        SUM(COALESCE(CAST(orderdetail.product_weight AS FLOAT), 0) * COALESCE(CAST(orderdetail.product_price AS FLOAT), 0)) AS total_weight_price
      FROM hours
        LEFT JOIN orders o ON FLOOR(TIME_FORMAT(o.created_at, '%H')) + 1 = hours.hour_group AND DATE(o.created_at) = CAST(? AS DATE)
        LEFT JOIN orderdetail ON o.id = orderdetail.order_id AND orderdetail.isDelete = 0
        LEFT JOIN product ON product.idProduct = orderdetail.idProduct
      GROUP BY hours.hour_group
      ORDER BY hours.hour_group;
    `;
  }

  try {
    const params = pd !== '0' ? [pd, pd, date] : [date];
    const results = await query(queryFormat, params);
    res.send(results);
  } catch (err) {
    res.status(500).send({ error: true, message: 'Database error', details: err.message });
  }
});

app.get('/getProductJoinType', async (req, res) => {
  try {
    const results = await query(`
      SELECT product.*, producttype.ProductType_Name
      FROM product
      JOIN producttype ON product.ProductType_idProductType = producttype.idProductType
      WHERE product.isDeleted = 0
    `);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: true, message: 'Database error', details: err.message });
  }
});

app.get('/orderDetailJoin/:code', async (req, res) => {
  const code = req.params.code;
  try {
    const results = await query(`
      SELECT
        orderdetail.id AS od_ID,
        product.idProduct AS pd_ID,
        product.ProductName AS pd_Name,
        producttype.ProductType_Name AS pd_TypeName,
        product.img AS pd_img,
        orderdetail.product_weight,
        orderdetail.product_price,
        orders.id AS order_ID,
        orders.created_at
      FROM orderdetail
      JOIN product ON orderdetail.idProduct = product.idProduct
      JOIN producttype ON product.ProductType_idProductType = producttype.idProductType
      JOIN orders ON orderdetail.order_id = orders.id
      WHERE orderdetail.order_id = ?
    `, [code]);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: true, message: 'Database error', details: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Node app is running on port', process.env.PORT || 3000);
});

module.exports = app;

