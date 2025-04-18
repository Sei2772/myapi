const express = require('express');
const cors = require('cors');
const mysql = require('mysql2')
require('dotenv').config();

var app = express();

const connection = mysql.createConnection(process.env.DATABASE_URL)

// var bodyParser = require('body-parser');
// const bcrypt = require('bcryptjs');

// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));


app.get('/', function (req, res) {
    res.json({msg: 'it working!'})
});

// var db = mysql.createConnection({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
// });

// dbcon.connect();

// ดึงข้อมูลทั้งหมดจาก users
app.get('/allUsers', function (req, res) {
    connection.query('SELECT * FROM users', function (error, results, fields) {
        if (error) throw error;
        return res.send(results);
    });
});

// เพิ่มข้อมูลผู้ใช้
app.post('/user', function (req, res) {
    var user = req.body;
    if (!user) {
        return res.status(400).send({ error: true, message: 'Please provide user data' });
    }
    connection.query("INSERT INTO users SET ?", user, function (error, results, fields) {
        if (error) throw error;
        return res.send(results);
    });
});

// อัปเดตข้อมูลผู้ใช้
app.put('/update/:id', function (req, res) {
    var user_id = req.params.id;
    var user_data = req.body;

    if (!user_id || !user_data || Object.keys(user_data).length === 0) {
        return res.status(400).send({ error: true, message: 'Please provide user data' });
    }

    connection.query("UPDATE users SET ? WHERE user_id = ?", [user_data, user_id], function (error, results, fields) {
        if (error) {
            return res.status(500).send({ error: true, message: 'Database error', details: error });
        }

        if (results.affectedRows === 0) {
            return res.status(404).send({ error: true, message: 'User not found' });
        }

        return res.send({ error: false, data: results, message: 'User updated successfully.' });
    });
});

// ลบข้อมูลผู้ใช้
app.delete('/delete/:id', function (req, res) {
    var user_id = req.params.id;
    if (!user_id) {
        return res.status(400).send({ error: true, message: 'Please provide user ID' });
    }
    connection.query('DELETE FROM users WHERE user_id = ?', user_id, function (error, results, fields) {
        if (error) throw error;
        return res.send({ error: false, data: results, message: 'User deleted successfully.' });
    });
});

app.post('/register', async function (req, res) {
    let post = req.body;
    let user_id = post.user_id;
    let user_name = post.user_name;
    let password = post.password;
    let role = 'employee';  // 🛑 *ตั้งค่า Role ตายตัว ห้ามเปลี่ยน*

    const salt = await bcrypt.genSalt(10);
    let password_hash = await bcrypt.hash(password, salt);

    connection.query('SELECT * FROM users WHERE user_id = ?', [user_id], function (error, results, fields) {
        if (error) throw error;
        if (results[0]) {
            return res.status(400).send({ error: true, message: 'This user ID is already in the database.' });
        } else {
            let insertData = "INSERT INTO users (user_id, user_name, password, role) VALUES (?, ?, ?, ?)";
            connection.query(insertData, [user_id, user_name, password_hash, role], function (error, results) {
                if (error) throw error;
                return res.send({ success: true, message: 'User registered successfully.' });
            });
        }
    });
});

// เพิ่มสินค้าใหม่ (POST /products)
app.post('/products', function (req, res) {
let productData = req.body;

if (!productData.ProductName || !productData.Price_gram || !productData.quantity || !productData.ProductType_idProductType || !productData.img) {
    return res.status(400).send({ error: true, message: 'Please provide all product details.' });
}

let newProduct = {
    ProductName: productData.ProductName,
    Price_gram: productData.Price_gram,
    quantity: productData.quantity,
    ProductType_idProductType: productData.ProductType_idProductType,
    img: productData.img
};

connection.query('INSERT INTO product SET ?', newProduct, function (error, results) {
    if (error) {
        return res.status(500).send({ error: true, message: 'Database error', details: error });
    }
    return res.send({ success: true, message: 'Product added successfully.', productId: results.insertId });
});
});

// เข้าสู่ระบบ
app.post('/login', function (req, res) {
    let user = req.body;
    let user_id = user.user_id;
    let password = user.password;

    if (!user_id || !password) {
        return res.status(400).send({ error: true, message: 'Please provide user ID and password.' });
    }

    connection.query('SELECT * FROM users WHERE user_id = ?', [user_id], function (error, results, fields) {
        if (error) throw error;
        if (results[0]) {
            bcrypt.compare(password, results[0].password, function (error, result) {
                if (error) throw error;
                if (result) {
                    return res.send({ success: true, user_id: results[0].user_id, role: results[0].role });
                } else {
                    return res.send({ success: false, message: 'Incorrect password' });
                }
            });
        } else {
            return res.send({ success: false, message: 'User not found' });
        }
    });
});

// ค้นหาข้อมูลผู้ใช้ตาม user_id
app.get('/search/:id', function (req, res) {
    let user_id = req.params.id;
    if (!user_id) {
        return res.status(400).send({ error: true, message: 'Please provide user ID' });
    }
    connection.query('SELECT * FROM users WHERE user_id = ?', user_id, function (error, result, fields) {
        if (error) throw error;
        if (result[0]) {
            return res.send({
                user_id: result[0].user_id,
                user_name: result[0].user_name,
                role: result[0].role
            });
        } else {
            return res.status(404).send({ error: true, message: 'User not found' });
        }
    });
});

app.patch('/products/:id', (req, res) => {
    const product_id = req.params.id;
    const updateData = req.body;

    // ตรวจสอบว่า ID และข้อมูลที่ต้องการอัปเดตถูกต้องหรือไม่
    if (!product_id || Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: true, message: 'กรุณาระบุข้อมูลสินค้าให้ครบถ้วน' });
    }

    // ตรวจสอบว่า idProduct มีอยู่จริงหรือไม่
    connection.query('SELECT * FROM product WHERE idProduct = ?', [product_id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: true, message: 'Database error', details: err });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: true, message: 'ไม่พบสินค้าที่ต้องการอัปเดต' });
        }

        // อัปเดตข้อมูลสินค้า
        connection.query('UPDATE product SET ? WHERE idProduct = ?', [updateData, product_id], (error, results) => {
            if (error) {
                return res.status(500).json({ error: true, message: 'Database error', details: error });
            }
            return res.json({ success: true, message: 'อัปเดตสินค้าสำเร็จ' });
        });
    });
});

app.put("/deleteProduct/:id", async (req, res) => {
    try {
        const { id } = req.params;
        console.log("กำลังลบสินค้า ID:", id); // Debug log

        if (!id || isNaN(id)) {
            return res.status(400).json({ error: "รหัสสินค้าที่ส่งมาไม่ถูกต้อง" });
        }

        // ตรวจสอบว่าสินค้ามีอยู่จริง
        connection.query("SELECT * FROM product WHERE idProduct = ?", [id], (error, results) => {
            if (error) {
                return res.status(500).json({ error: "Database error", details: error });
            }
            if (results.length === 0) {
                return res.status(404).json({ error: "ไม่พบสินค้า" });
            }

            // ทำ Soft Delete
            connection.query("UPDATE product SET isDeleted = TRUE WHERE idProduct = ?", [id], (error, result) => {
                if (error) {
                    return res.status(500).json({ error: "เกิดข้อผิดพลาดขณะลบสินค้า" });
                }
                return res.status(200).json({ message: "ลบสินค้าสำเร็จ" });
            });
        });

    } catch (error) {
        console.error("เกิดข้อผิดพลาด:", error);
        res.status(500).json({ error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
    }
});

// ดึงข้อมูลคำสั่งซื้อทั้งหมด
app.get('/orders', function (req, res) {
    connection.query('SELECT * FROM orderdetail', function (error, results, fields) {
        if (error) return res.status(500).send({ error: true, message: 'Database error', details: error });
        return res.send(results);
    });
});

// ดึงข้อมูลคำสั่งซื้อผ่าน order_id
app.get('/order/:id', function (req, res) {
    let order_id = req.params.id;
    if (!order_id) {
        return res.status(400).send({ error: true, message: 'Please provide order ID' });
    }
    connection.query('SELECT * FROM orderdetail WHERE order_id = ?', [order_id], function (error, results, fields) {
        if (error) return res.status(500).send({ error: true, message: 'Database error', details: error });
        return res.send(results);
    });
});

app.get("/products/:id", (req, res) => {
    const productId = req.params.id;
    console.log("API ถูกเรียกด้วย ID:", productId); // เพิ่ม Log ตรวจสอบ
    connection.query("SELECT * FROM product WHERE idProduct = ?", [productId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: "ไม่พบสินค้า" });
        res.json(results[0]);
    });
});

app.post('/add', function (req, res) {  
    let orderData = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จำเป็น
    if (!orderData.product_name || !orderData.product_weight) {
        return res.status(400).send({ error: true, message: 'Please provide order details' });
    }

    // ดึง Order ID ล่าสุดจากตาราง orders
    connection.query('SELECT id FROM orders ORDER BY id DESC LIMIT 1', function (error, results) {
        if (error) {
            console.error('Database error when fetching order id:', error);  // เพิ่มการแสดงข้อผิดพลาด
            return res.status(500).send({ error: true, message: 'Database error', details: error });
        }

        let latestOrderId = 1;  // กำหนดค่า default หากไม่มีคำสั่งซื้อ (กรณีไม่มีคำสั่งซื้อในระบบ)

        // ถ้าไม่มีคำสั่งซื้อใดๆ ให้สร้างคำสั่งซื้อใหม่
        if (results.length === 0) {
            // สร้างคำสั่งซื้อใหม่
            connection.query('INSERT INTO orders (created_at) VALUES (NOW())', function (error, result) {
                if (error) {
                    console.error('Error creating order:', error);  // เพิ่มการแสดงข้อผิดพลาด
                    return res.status(500).send({ error: true, message: 'Database error when creating order', details: error });
                }
                latestOrderId = result.insertId; // ได้ค่า ID ของคำสั่งซื้อใหม่
            });
        } else {
            latestOrderId = results[0].id;  // ใช้ Order ID ล่าสุด ถ้ามีคำสั่งซื้อ
        }

        // เตรียมข้อมูลสำหรับการเพิ่มหรืออัปเดตสินค้าใน OrderDetail
        let newOrderDetail = {
            order_id: latestOrderId,
            product_name: orderData.product_name,
            product_weight: orderData.product_weight
        };

        // ตรวจสอบว่ามีรายการสินค้านี้ใน orderdetail หรือยัง
        connection.query('SELECT * FROM orderdetail WHERE order_id = ? AND product_name = ?', [latestOrderId, orderData.product_name], function (error, results) {
            if (error) {
                console.error('Error checking orderdetail:', error);  // เพิ่มการแสดงข้อผิดพลาด
                return res.status(500).send({ error: true, message: 'Database error when checking order detail', details: error });
            }

            if (results.length > 0) {
                // ถ้ามีข้อมูลสินค้าใน orderdetail แล้ว ให้ทำการอัปเดต
                connection.query('UPDATE orderdetail SET product_weight = ? WHERE order_id = ? AND product_name = ?',
                    [orderData.product_weight, latestOrderId, orderData.product_name], function (error, results) {
                    if (error) {
                        console.error('Error updating orderdetail:', error);  // เพิ่มการแสดงข้อผิดพลาด
                        return res.status(500).send({ error: true, message: 'Database error when updating order detail', details: error });
                    }

                    // อัปเดต quantity ใน product
                    connection.query('UPDATE product SET quantity = quantity - ? WHERE ProductName = ?',
                        [orderData.product_weight, orderData.product_name], function (error, results) {
                            if (error) {
                                console.error('Error updating product quantity:', error);  // เพิ่มการแสดงข้อผิดพลาด
                                return res.status(500).send({ error: true, message: 'Database error when updating product quantity', details: error });
                            }
                            return res.send({ success: true, message: 'Order updated and product quantity updated successfully.' });
                    });
                });
            } else {
                // ถ้าไม่มีข้อมูลสินค้า ให้เพิ่มข้อมูลใหม่
                connection.query('INSERT INTO orderdetail SET ?', newOrderDetail, function (error, results) {
                    if (error) {
                        console.error('Error inserting into orderdetail:', error);  // เพิ่มการแสดงข้อผิดพลาด
                        return res.status(500).send({ error: true, message: 'Database error when adding order detail', details: error });
                    }

                    // อัปเดต quantity ใน product
                    connection.query('UPDATE product SET quantity = quantity - ? WHERE ProductName = ?',
                        [orderData.product_weight, orderData.product_name], function (error, results) {
                            if (error) {
                                console.error('Error updating product quantity:', error);  // เพิ่มการแสดงข้อผิดพลาด
                                return res.status(500).send({ error: true, message: 'Database error when updating product quantity', details: error });
                            }
                            return res.send({ success: true, message: 'Order added and product quantity updated successfully.' });
                    });
                });
            }
        });
    });
});

app.delete('/order/:id', function (req, res) {
    let order_id = req.params.id;
    if (!order_id) {
        return res.status(400).send({ error: true, message: 'Please provide order ID' });
    }
    connection.query('DELETE FROM orderdetail WHERE order_id = ?', [order_id], function (error, results, fields) {
        if (error) return res.status(500).send({ error: true, message: 'Database error', details: error });

        if (results.affectedRows === 0) {
            return res.status(404).send({ error: true, message: 'Order not found' });
        }

        return res.send({ success: true, message: 'Order deleted successfully.' });
    });
});

app.get("/topproducts", (req, res) => {
    const sql = `
    SELECT * FROM product
    WHERE isDeleted = 0
    ORDER BY quantity DESC
    LIMIT 4
    `;
    connection.query(sql, function (error, results) {
        if (error) return res.status(500).send({ error: true, message: 'Database error', details: error });
        return res.send(results);  // ส่งผลลัพธ์กลับไปยัง client
    });
});

// API เพิ่มรายละเอียดคำสั่งซื้อ (/api/orderdetail)
app.post("/api/orderdetail", async (req, res) => {
    try {
        const { order_id, product_name, product_weight, idProduct } = req.body; // รับ idProduct จาก request body

        await connection.query(
            "INSERT INTO orderdetail (order_id, product_name, product_weight, idProduct) VALUES (?, ?, ?, ?)",
            [order_id, product_name, product_weight, idProduct]
        );

        res.json({ message: "Order detail added successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API เพิ่มรายละเอียดคำสั่งซื้อ (/orderdetail/add)
app.post('/orderdetail/add', async (req, res) => {
    const { order_id, product_name, product_weight, idProduct } = req.body; // รับ idProduct จาก request body

    if (!order_id || !product_name || !product_weight || !idProduct) {
        return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    }

    try {
        const sql = "INSERT INTO orderdetail (order_id, product_name, product_weight, idProduct) VALUES (?, ?, ?, ?)";
        await connection.query(sql, [order_id, product_name, product_weight, idProduct]);

        res.status(201).json({ message: "เพิ่ม orderdetail สำเร็จ!" });
    } catch (error) {
        res.status(500).json({ message: "เกิดข้อผิดพลาด", error: error.message });
    }
});

// API สร้างคำสั่งซื้อใหม่ (/neworder)
app.post('/neworder', function (req, res) {
    let user_id = req.body.user_id; // รับ user_id จาก request body

    if (!user_id) {
        return res.status(400).send({ error: true, message: 'Please provide user_id' });
    }

    let newOrder = { created_at: new Date(), user_id: user_id };

    connection.query('INSERT INTO orders SET ?', newOrder, function (error, results) {
        if (error) {
            return res.status(500).send({ error: true, message: 'Database error', details: error });
        }

        return res.send({ success: true, message: 'New order created successfully.', order_id: results.insertId });
    });
});

// API ดึงข้อมูลสินค้า (/products, /products/filter, /search/products)
app.get('/products', function (req, res) {
    let { ProductType_idProductType } = req.query;
    let query = 'SELECT * FROM product WHERE isDeleted = FALSE';
    let params = [];

    if (ProductType_idProductType) {
        query += ' AND ProductType_idProductType = ?';
        params.push(ProductType_idProductType);
    }

    connection.query(query, params, function (error, results) {
        if (error) return res.status(500).json({ error: true, message: 'Database error', details: error });
        return res.json(results);
    });
});

app.get('/products/filter', function (req, res) {
    let { ProductType_idProductType } = req.query;

    if (!ProductType_idProductType) {
        return res.status(400).json({ error: true, message: 'กรุณาระบุ ProductType_idProductType' });
    }

    connection.query('SELECT * FROM product WHERE ProductType_idProductType = ? AND isDeleted = FALSE',
        [ProductType_idProductType],
        function (error, results) {
            if (error) return res.status(500).json({ error: true, message: 'Database error', details: error });
            return res.json(results);
        }
    );
});

app.get('/search/products', function (req, res) {
    let { name, min_price, max_price, category, ProductType_idProductType } = req.query; // เพิ่ม ProductType_idProductType
    let query = 'SELECT * FROM product WHERE isDeleted = FALSE';
    let params = [];

    if (name) {
        query += ' AND ProductName LIKE ?'; // แก้ไขเป็น ProductName
        params.push(`%${name}%`);
    }
    if (min_price) {
        query += ' AND Price_gram >= ?'; // แก้ไขเป็น Price_gram
        params.push(min_price);
    }
    if (max_price) {
        query += ' AND Price_gram <= ?'; // แก้ไขเป็น Price_gram
        params.push(max_price);
    }
    if (category) {
        query += ' AND ProductType_idProductType = ?'; // แก้ไขเป็น ProductType_idProductType
        params.push(category);
    }
    if (ProductType_idProductType) {
        query += ' AND ProductType_idProductType = ?';
        params.push(ProductType_idProductType);
    }

    connection.query(query, params, function (error, results) {
        if (error) return res.status(500).json({ error: true, message: 'Database error', details: error });
        return res.json(results);
    });
});

app.get('/products/filter', function (req, res) {
    let { ProductType_idProductType } = req.query;

    if (!ProductType_idProductType) {
        return res.status(400).json({ error: true, message: 'กรุณาระบุ ProductType_idProductType' });
    }

    connection.query('SELECT * FROM product WHERE idProduct  = ? AND isDeleted = FALSE',
        [ProductType_idProductType],
        function (error, results) {
            if (error) return res.status(500).json({ error: true, message: 'Database error', details: error });
            return res.json(results);
        }
    );
});

app.get("/api/orders/details", (req, res) => {
    const sql = `
        SELECT orders.created_at, orderdetail.goods_name, SUM(orderdetail.goods_weight) as total_weight
        FROM orderdetail
        JOIN orders ON orderdetail.order_id = orders.id
        GROUP BY orders.created_at, orderdetail.goods_name
        ORDER BY orders.created_at ASC;
    `;

    connection.query(sql, (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(results);
        }
    });
});

app.get('/orderdetails', function (req, res) {
    const sql = `
        SELECT orderdetail.order_id,
            orderdetail.goods_name,
            orderdetail.goods_weight,
            orders.created_at
        FROM orderdetail
        JOIN orders ON orderdetail.order_id = orders.id;
    `;

    connection.query(sql, function (error, results) {
        if (error) {
            return res.status(500).send({ error: true, message: 'Database error', details: error });
        }
        return res.send(results);
    });
});

// API สำหรับ Dashboard
app.get('/dashboard', function (req, res) {
    let query = `
        SELECT
            (SELECT COUNT(*) FROM orderdetail) AS total_orders,
            (SELECT COUNT(*) FROM products) AS total_products,
            (SELECT SUM(goods_weight) FROM orderdetail) AS total_sales
    `;
    connection.query(query, function (error, results) {
        if (error) return res.status(500).send({ error: true, message: 'Database error', details: error });
        return res.send(results[0]);
    });
});

// เริ่มต้นเซิร์ฟเวอร์    
app.listen(process.env.PORT || 3000, function () {
    console.log('Node app is running on port 3000');
});
module.exports = app;