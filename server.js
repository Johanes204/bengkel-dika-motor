const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./config/db');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use('/admin/exports', express.static(path.join(__dirname, 'data', 'exports')));
app.use(bodyParser.json()); // untuk menerima JSON
app.use(bodyParser.urlencoded({ extended: true })); // untuk form biasa

// Endpoint untuk menyimpan data
app.get('/customers', (req, res) => {
    const sql = 'SELECT * FROM customers';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Query error:', err);
            return res.status(500).json({ error: 'Gagal mengambil data' });
        }
        
        res.json(results);
    });
});

app.post('/addCustomers', (req, res) => {
    const { name, phone, address} = req.body;
    const sql = 'INSERT INTO customers (name_customer, phone_customer, address_customer) VALUES (?, ?, ?)';
    db.query(sql, [name, phone, address], (err, result) => {
    if (err) {
        console.error('Insert error:', err);
        return res.status(500).json({ error: 'Gagal menyimpan data' });
    }
    res.status(201).json({ message: 'Data berhasil disimpan', id: result.insertId });
    });
});

// produk
app.get('/products', (req, res) => {
    const sql = 'SELECT * FROM products';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Query error:', err);
            return res.status(500).json({ error: 'Gagal mengambil data' });
        }
        
        res.json(results);
    });
});



// Transaksi
    app.post('/addTransaction', (req, res) => {
    const { customer, items, total_transactions } = req.body;

    // 1. Simpan customer
    const customerQuery = 'INSERT INTO customers (name_customer, phone_customer, address_customer) VALUES (?, ?, ?)';
    db.query(customerQuery, [customer.name_customer, customer.phone_customer, customer.address_customer], (err, customerResult) => {
        if (err) return res.status(500).send(err);

        const id_customer = customerResult.insertId;

        // 2. Simpan transaksi
        const transactionQuery = 'INSERT INTO transactions (id_customer, total_transactions) VALUES (?, ?)';
        db.query(transactionQuery, [id_customer, total_transactions], (err, transactionResult) => {
        if (err) return res.status(500).send(err);

        const id_transaction = transactionResult.insertId;

        // 3. Simpan semua item
        const itemQuery = 'INSERT INTO transactions_item (id_transaction, id_product) VALUES ?';
        const itemValues = items.map(item => [id_transaction, item.id_product]);

        db.query(itemQuery, [itemValues], (err, itemResult) => {
            if (err) return res.status(500).send(err);

            res.send({
            message: 'Transaksi berhasil disimpan!',
            id_transaction,
            id_customer,
            items: itemValues
            });
        });
        });
    });
    });

// folder untuk simpan gambar
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'img/produk-oli'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

// route simpan produk
app.post('/addProducts', upload.single('img_product'), (req, res) => {
    const { name_product, detail_product, price_product } = req.body;
    const img_product = req.file.filename;

    const sql = `INSERT INTO products (name_product, img_product, detail_product, price_product)
                VALUES (?, ?, ?, ?)`;

    db.query(sql, [name_product, img_product, detail_product, price_product], (err, result) => {
        if (err) {
            console.error('Insert produk gagal:', err);
            return res.status(500).json({ message: 'Gagal menyimpan produk' });
        }
        res.status(201).json({ message: 'Produk berhasil ditambahkan', id: result.insertId });
    });
});

app.get('/products', (req, res) => {
  const sql = 'SELECT * FROM products ORDER BY id_product DESC';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Gagal ambil produk' });

    // tambahkan path lengkap gambar
    const updated = results.map(p => ({
        ...p,
        img_product: `/img/produk-oli/${p.img_product}`
    }));

        res.json(updated);
    });
});

//EDIT PRODUCT ADMIN
// === UPDATE PRODUCT ADMIN ===
app.put('/products/:id', upload.single('img_product'), (req, res) => {
    const { name_product, detail_product, price_product } = req.body;
    let sql, values;

    if (req.file) {
        // Jika gambar baru diupload
        sql = `UPDATE products 
                SET name_product = ?, detail_product = ?, price_product = ?, img_product = ? 
                WHERE id_product = ?`;
        values = [name_product, detail_product, price_product, req.file.filename, req.params.id];
    } else {
        // Jika gambar tidak diubah
        sql = `UPDATE products 
                SET name_product = ?, detail_product = ?, price_product = ? 
                WHERE id_product = ?`;
        values = [name_product, detail_product, price_product, req.params.id];
    }

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Update produk gagal:', err);
            return res.status(500).json({ message: 'Gagal mengupdate produk' });
        }
        res.json({ message: 'Produk berhasil diupdate' });
    });
});


// DELETE PRODUCT ADMIN
app.delete('/products/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM products WHERE id_product = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Gagal hapus produk:', err);
            return res.status(500).json({ message: 'Gagal hapus produk' });
        }
        res.json({ message: 'Produk berhasil dihapus' });
    });
});


// REGISTER ADMIN
app.post('/register', (req, res) => {
    const { username_admin, email_admin, password_admin } = req.body;
    const sql = 'INSERT INTO admin (username_admin, email_admin, password_admin) VALUES (?, ?, ?)';
    db.query(sql, [username_admin, email_admin, password_admin], (err, result) => {
        if (err) {
            console.error('Gagal register:', err);
            return res.status(500).json({ message: 'Gagal register admin' });
        }
        res.status(201).json({ message: 'Admin berhasil register' });
    });
});

// LOGIN ADMIN
app.post('/login', (req, res) => {
    const { username_admin, password_admin } = req.body;
    const sql = 'SELECT * FROM admin WHERE username_admin = ? AND password_admin = ?';
    db.query(sql, [username_admin, password_admin], (err, results) => {
        if (err) {
            console.error('Gagal login:', err);
            return res.status(500).json({ message: 'Gagal login admin' });
        }
        if (results.length === 0) {
            return res.status(401).json({ message: 'Username atau password salah' });
        }
        res.json({
            message: 'Login berhasil',
            username_admin: results[0].username_admin,
            email_admin: results[0].email_admin
        });
    });
});


// AI Chat endpoint — Ollama (native tool calling + per-session memory)
const aiService = require('./services/ollamaService');
const crypto = require('crypto');

// helper buat SSE event
function sseSend(res, event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Chat streaming (SSE) — dipakai UI AI agent (user) dan AI admin
app.post('/chat/stream', async (req, res) => {
    const { message, sessionId, mode } = req.body;
    if (!message || !message.trim()) {
        return res.status(400).json({ answer: 'Pesan tidak boleh kosong.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sid = sessionId || crypto.randomUUID();
    sseSend(res, 'session', { sessionId: sid });

    try {
        await aiService.chat(sid, message, (ev) => sseSend(res, ev.type, ev), { mode: mode || 'user' });
        sseSend(res, 'done', { sessionId: sid });
    } catch (err) {
        console.error('AI Error:', err);
        sseSend(res, 'error', { message: err.message || 'Terjadi kesalahan.' });
    } finally {
        res.end();
    }
});

// Chat non-streaming (fallback / API biasa)
app.post('/chat', async (req, res) => {
    const { message, sessionId, mode } = req.body;
    if (!message) return res.status(400).json({ answer: 'Pesan tidak boleh kosong.' });

    const sid = sessionId || crypto.randomUUID();
    try {
        const answer = await aiService.chat(sid, message, undefined, { mode: mode || 'user' });
        res.json({ answer, sessionId: sid });
    } catch (err) {
        console.error('AI Error:', err);
        res.json({ answer: 'Maaf, terjadi kesalahan. Pastikan Ollama sudah berjalan.', sessionId: sid });
    }
});

// Riwayat percakapan per sesi
app.get('/chat/history', (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: 'sessionId wajib diisi' });
    res.json({ messages: aiService.getSessionHistory(sessionId) });
});

// Reset / hapus sesi
app.post('/chat/reset', (req, res) => {
    const { sessionId } = req.body;
    if (sessionId) aiService.resetSession(sessionId);
    res.json({ ok: true });
});

// ====== JANJI SERVIS ======

// Status yang diizinkan untuk janji servis
const APPOINTMENT_STATUS = ['terjadwal', 'diproses', 'selesai', 'batal'];

// Pastikan tabel service_appointments ada dan punya kolom status
// (untuk tabel lama yang belum punya kolom status, akan otomatis ditambahkan)
function ensureAppointmentTable(cb) {
    const sqlCreate = `
        CREATE TABLE IF NOT EXISTS service_appointments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nama VARCHAR(100) NOT NULL,
            telepon VARCHAR(20) NOT NULL,
            tanggal VARCHAR(20) NOT NULL,
            keluhan TEXT DEFAULT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'terjadwal',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    db.query(sqlCreate, (err) => {
        if (err) return cb(err);
        const check = `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'service_appointments'
              AND COLUMN_NAME = 'status'`;
        db.query(check, (err2, rows) => {
            if (err2) return cb(err2);
            if (rows[0].c === 0) {
                const alter = `ALTER TABLE service_appointments
                    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'terjadwal'`;
                return db.query(alter, cb);
            }
            cb(null);
        });
    });
}

// daftar janji servis untuk halaman user (publik)
app.get('/appointments', (req, res) => {
    ensureAppointmentTable((err) => {
        if (err) return res.status(500).json({ error: 'Gagal memuat data' });
        const sql = 'SELECT id, nama, tanggal, keluhan, status FROM service_appointments ORDER BY tanggal ASC, id ASC';
        db.query(sql, (err2, results) => {
            if (err2) {
                console.error('Query error:', err2);
                return res.status(500).json({ error: 'Gagal memuat data' });
            }
            res.json(results);
        });
    });
});

// buat janji servis baru (dari halaman publik)
app.post('/appointments', (req, res) => {
    const { nama, telepon, tanggal, keluhan } = req.body;
    const buatJanjiServis = require('./tools/buatJanjiServis');
    buatJanjiServis({ nama, telepon, tanggal, keluhan })
        .then((msg) => res.status(201).json({ message: 'Janji servis berhasil dibuat', detail: msg }))
        .catch((err) => res.status(400).json({ message: err.message }));
});

// daftar janji servis untuk halaman admin (lengkap)
app.get('/admin/appointments', (req, res) => {
    ensureAppointmentTable((err) => {
        if (err) return res.status(500).json({ error: 'Gagal memuat data' });
        const sql = 'SELECT id, nama, telepon, tanggal, keluhan, status, created_at FROM service_appointments ORDER BY tanggal ASC, id ASC';
        db.query(sql, (err2, results) => {
            if (err2) {
                console.error('Query error:', err2);
                return res.status(500).json({ error: 'Gagal memuat data' });
            }
            res.json(results);
        });
    });
});

// ubah status janji servis oleh admin
app.put('/appointments/:id/status', (req, res) => {
    const { status } = req.body;
    if (!APPOINTMENT_STATUS.includes(status)) {
        return res.status(400).json({ message: 'Status tidak valid' });
    }
    ensureAppointmentTable((err) => {
        if (err) return res.status(500).json({ message: 'Gagal memuat data' });
        const sql = 'UPDATE service_appointments SET status = ? WHERE id = ?';
        db.query(sql, [status, req.params.id], (err2, result) => {
            if (err2) {
                console.error('Update status gagal:', err2);
                return res.status(500).json({ message: 'Gagal mengubah status' });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Janji servis tidak ditemukan' });
            }
            res.json({ message: 'Status berhasil diubah', id: req.params.id, status });
        });
    });
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});