const db = require("../config/db");

function tambahPelanggan(params) {
    return new Promise((resolve, reject) => {
        const { nama, telepon, alamat } = params;
        if (!nama || !telepon) return reject(new Error("Nama dan telepon wajib diisi."));
        if (!/^[0-9+\s-]{9,15}$/.test(telepon)) return reject(new Error("Nomor telepon tidak valid. Contoh: 081234567890."));

        const sql = "INSERT INTO customers (name_customer, phone_customer, address_customer) VALUES (?, ?, ?)";
        db.query(sql, [nama, telepon, alamat || "-"], (err, result) => {
            if (err) return reject(err);
            resolve(`Pelanggan "${nama}" berhasil didaftarkan (ID: ${result.insertId}).`);
        });
    });
}

module.exports = tambahPelanggan;
