const db = require("../config/db");

const SYNONYM_MAP = [
    [/\bshock ?breaker|sokbreker|shock ?breker|shock breaker|shock belakang/gi, "shock breaker"],
    [/\bspare ?part|onderdil|suku ?cadang/gi, "sparepart"],
    [/\bolie|oli motor|oli mesin/gi, "oli"],
    [/\bvanbelt|v-belt|cv ?belt|belt cvt/gi, "cv belt"],
    [/\bban luar/gi, "ban luar"],
    [/\bban dalam/gi, "ban dalam"],
];

function normalizeKeyword(keyword) {
    let k = String(keyword || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
    for (const [pattern, replacement] of SYNONYM_MAP) {
        k = k.replace(pattern, replacement);
    }
    return k;
}

function buildWhereAndParams(keywords, columns) {
    const clauses = [];
    const params = [];
    keywords.forEach((k) => {
        columns.forEach((col) => {
            clauses.push(`${col} LIKE ?`);
            params.push(`%${k}%`);
        });
    });
    return { clause: clauses.join(" OR "), params };
}

function searchByKeyword(keyword, limit = 6) {
    return new Promise((resolve, reject) => {
        const k = normalizeKeyword(keyword);
        if (!k) return reject(new Error("Keyword pencarian kosong."));

        const keywords = [...new Set([k, ...k.split(/\s+/).filter((w) => w.length > 1)])].slice(0, 4);

        const columns = ["name_product", "detail_product"];
        const { clause, params } = buildWhereAndParams(keywords, columns);

        const scoreExpr = keywords
            .map((kw, i) =>
                columns.map((col) => `(CASE WHEN ${col} LIKE ? THEN 1 ELSE 0 END)`).join(" + ")
            )
            .map((expr, i) => `(${expr}) * ${keywords.length - i}`)
            .join(" + ");

        const sql = `SELECT *, (${scoreExpr}) AS score
                     FROM products
                     WHERE ${clause}
                     ORDER BY score DESC, id_product ASC
                     LIMIT ?`;

        const allParams = [];
        keywords.forEach((kw) => {
            columns.forEach(() => allParams.push(`%${kw}%`));
        });
        keywords.forEach((kw) => {
            columns.forEach(() => allParams.push(`%${kw}%`));
        });
        allParams.push(limit);

        db.query(sql, allParams, (err, results) => {
            if (err) return reject(err);
            resolve(results.filter((p) => Number(p.score) > 0));
        });
    });
}

function formatProducts(results) {
    return results
        .map((p) => `• ${p.name_product} — Rp${Number(p.price_product).toLocaleString("id-ID")}\n  ${p.detail_product || "-"}`)
        .join("\n\n");
}

function listAllProducts(limit = 6) {
    return new Promise((resolve, reject) => {
        db.query("SELECT * FROM products ORDER BY id_product ASC LIMIT ?", [limit], (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
}

async function cariProduk(params) {
    const keyword = (params.keyword || params.nama || params.query || "").trim();
    if (!keyword) {
        const all = await listAllProducts();
        return all.length
            ? "Berikut produk yang tersedia di Bengkel Dika Motor:\n\n" + formatProducts(all)
            : "Belum ada produk yang terdaftar di bengkel kami.";
    }

    const results = await searchByKeyword(keyword);

    if (results.length > 0) {
        return `Produk ditemukan untuk "${keyword}":\n\n${formatProducts(results)}\n\nMau cari produk lain atau langsung memesan?`;
    }

    const all = await listAllProducts();
    if (all.length) {
        return `Tidak ada produk yang cocok dengan "${keyword}". Berikut produk yang tersedia saat ini:\n\n${formatProducts(all)}`;
    }
    return "Tidak ada produk yang cocok di bengkel kami.";
}

module.exports = cariProduk;
