const db = require("../config/db");

function getById(id) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT id_product, name_product, detail_product, price_product
                     FROM products WHERE id_product = ? LIMIT 1`;
        db.query(sql, [id], (err, rows) => {
            if (err) return reject(err);
            resolve(rows[0] || null);
        });
    });
}

function findByName(nama) {
    const keywords = [...new Set([nama, ...nama.split(/\s+/).filter((w) => w.length > 1)])].slice(0, 4);
    const clauses = [];
    const params = [];
    keywords.forEach((k) => {
        clauses.push("name_product LIKE ?");
        params.push(`%${k}%`);
    });
    return new Promise((resolve, reject) => {
        const sql = `SELECT id_product, name_product, detail_product, price_product
                     FROM products
                     WHERE ${clauses.join(" OR ")}
                     ORDER BY id_product ASC
                     LIMIT 10`;
        db.query(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

function listSome(limit = 12) {
    return new Promise((resolve, reject) => {
        db.query(`SELECT id_product, name_product, detail_product, price_product
                  FROM products ORDER BY id_product ASC LIMIT ?`, [limit], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

function updateProduct(id, changes) {
    return new Promise((resolve, reject) => {
        const sets = [];
        const params = [];
        if (changes.name_product) { sets.push("name_product = ?"); params.push(changes.name_product); }
        if (changes.detail_product !== undefined && changes.detail_product !== null) { sets.push("detail_product = ?"); params.push(changes.detail_product); }
        if (changes.price_product !== undefined && changes.price_product !== null) { sets.push("price_product = ?"); params.push(changes.price_product); }
        if (sets.length === 0) return reject(new Error("Tidak ada perubahan bidang produk yang diberikan."));
        params.push(id);

        db.query(`UPDATE products SET ${sets.join(", ")} WHERE id_product = ?`, params, (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
    });
}

function formatProduct(p) {
    return `ID ${p.id_product}: **${p.name_product}**\n  Deskripsi: ${p.detail_product || "-"}\n  Harga: Rp${Number(p.price_product).toLocaleString("id-ID")}`;
}

async function ubahProduk(params = {}) {
    const id = Number(params.id) || 0;
    const nama = String(params.nama || params.cari || "").trim();

    let target = null;
    if (id) {
        target = await getById(id);
        if (!target) return `Produk dengan ID ${id} tidak ditemukan. Cek kembali ID produk atau sebutkan nama produknya.`;
    } else if (nama) {
        const matches = await findByName(nama);
        if (matches.length === 0) {
            const all = await listSome();
            const daftar = all.length ? all.map(formatProduct).join("\n\n") : "Belum ada produk terdaftar.";
            return `Tidak ditemukan produk yang cocok dengan "${nama}". Produk yang tersedia saat ini:\n\n${daftar}`;
        }
        if (matches.length > 1) {
            return `Ditemukan beberapa produk dengan kata "${nama}". Sebutkan yang mana yang ingin diubah (bisa pakai ID):\n\n${matches.map(formatProduct).join("\n\n")}`;
        }
        target = matches[0];
    } else {
        const all = await listSome();
        if (!all.length) return "Belum ada produk terdaftar di database.";
        return `Produk mana yang ingin diubah? Sebutkan nama atau ID produknya (contoh: "ubah produk dengan id ${all[0].id_product}"). Daftar produk:\n\n${all.map(formatProduct).join("\n\n")}`;
    }

    const changes = {};
    if (params.name_product) changes.name_product = String(params.name_product).trim();
    if (params.detail_product) changes.detail_product = String(params.detail_product).trim();
    if (params.price_product) {
        const harga = String(params.price_product).replace(/[^\d]/g, "");
        if (!harga) return "Harga produk tidak valid. Gunakan angka saja, contoh: 45000.";
        changes.price_product = Number(harga);
    }

    if (Object.keys(changes).length === 0) {
        return `Produk **${target.name_product}** (ID ${target.id_product}) ditemukan. Perubahan apa yang ingin dilakukan?\n\n${formatProduct(target)}\n\nContoh: "ubah deskripsi produk ${target.name_product} menjadi ..." atau "ubah harga produk tersebut menjadi 50000".`;
    }

    await updateProduct(target.id_product, changes);

    const hasil = {
        ...target,
        ...(changes.name_product ? { name_product: changes.name_product } : {}),
        ...(changes.detail_product ? { detail_product: changes.detail_product } : {}),
        ...(changes.price_product ? { price_product: changes.price_product } : {})
    };
    return `Produk "${target.name_product}" (ID ${target.id_product}) berhasil diperbarui:\n\n${formatProduct(hasil)}`;
}

module.exports = ubahProduk;