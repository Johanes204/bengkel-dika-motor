const db = require("../config/db");

function buatJanjiServis(params) {
    return new Promise((resolve, reject) => {
        const { nama, telepon, tanggal, keluhan } = params;
        if (!nama || !telepon || !tanggal) return reject(new Error("Nama, telepon, dan tanggal wajib diisi."));
        if (!/^[0-9+\s-]{9,15}$/.test(telepon)) return reject(new Error("Nomor telepon tidak valid. Contoh: 081234567890."));
        if (!/^\d{4}-\d{2}-\d{2}/.test(tanggal)) return reject(new Error("Format tanggal harus YYYY-MM-DD. Contoh: 2026-08-10."));

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
            if (err) return reject(err);

            const sql = "INSERT INTO service_appointments (nama, telepon, tanggal, keluhan) VALUES (?, ?, ?, ?)";
            db.query(sql, [nama, telepon, tanggal, keluhan || "-"], (err2, result) => {
                if (err2) return reject(err2);
                resolve(`Janji servis berhasil dibuat!\n  Nama: ${nama}\n  Telepon: ${telepon}\n  Tanggal: ${tanggal}\n  Keluhan: ${keluhan || "-"}\n  ID Janji: ${result.insertId}`);
            });
        });
    });
}

module.exports = buatJanjiServis;
