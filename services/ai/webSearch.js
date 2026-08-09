// ====== PENCARIAN INTERNET (SIMPLE, TANPA API KEY) ======
// Mengambil hasil pencarian Bing (format RSS) sebagai sumber jawaban tambahan
// ketika data bengkel (dataset RAG) tidak cukup relevan.
const axios = require("axios");

// Antar-jemput koneksi untuk mengelakkan blokir bot dasar
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TIMEOUT_MS = 12000;

function decodeEntities(s) {
    return String(s)
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'").replace(/&amp;/g, "&")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function cleanText(s) {
    return decodeEntities(s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// Cari di Bing RSS, kembalikan [{judul, url, cuplikan, sumber}]
async function cariInternet(pencarian, maxHasil = 6) {
    if (!pencarian || !pencarian.trim()) return [];
    const q = encodeURIComponent(pencarian.trim());

    // 1) Upaya utama: Bing RSS (gratis, tanpa API key)
    try {
        const res = await axios.get(`https://www.bing.com/search?q=${q}&format=rss&setlang=id`, {
            timeout: TIMEOUT_MS,
            headers: { "User-Agent": UA, "Accept-Language": "id-ID,id;q=0.9" }
        });
        const rss = res.data;
        const items = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)];
        const hasil = [];
        for (const m of items) {
            if (hasil.length >= maxHasil) break;
            const blok = m[1];
            const judul = cleanText(blok.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1] || "").trim();
            const url = (blok.match(/<link>\s*(.*?)\s*<\/link>/i)?.[1] || "").trim();
            const cuplikan = cleanText(blok.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1] || "").trim();
            if (!judul || !url) continue;
            let sumber = "";
            try { sumber = new URL(url).hostname.replace(/^www\./, ""); } catch { }
            hasil.push({ judul, url, cuplikan, sumber });
        }
        if (hasil.length > 0) return hasil;
    } catch (err) {
        if (process.env.NODE_ENV !== "production") {
            console.log("[webSearch] Bing RSS gagal:", err.message || err);
        }
    }

    // 2) Cadangan: lite.duckduckgo.com (jika Bing diblokir jaringan)
    try {
        const res = await axios.get(`https://lite.duckduckgo.com/lite/?q=${q}`, {
            timeout: TIMEOUT_MS,
            headers: { "User-Agent": UA, "Accept-Language": "id-ID,id;q=0.9" }
        });
        const html = res.data;
        const hasil = [];
        const re = /<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g;
        let m;
        while ((m = re.exec(html)) !== null && hasil.length < maxHasil) {
            const judul = cleanText(m[2]).trim();
            if (!judul) continue;
            const url = m[1].replace(/^\/\//, "https://");
            let sumber = "";
            try { sumber = new URL(url).hostname.replace(/^www\./, ""); } catch { }
            hasil.push({ judul, url, cuplikan: cleanText(m[3]).trim(), sumber });
        }
        return hasil;
    } catch (err) {
        if (process.env.NODE_ENV !== "production") {
            console.log("[webSearch] DuckDuckGo lite gagal:", err.message || err);
        }
        return [];
    }
}

// Format hasil pencarian jadi teks konteks untuk prompt.
function formatHasilPencarian(hasil) {
    if (!hasil || hasil.length === 0) return "";
    let teks = "\nHasil pencarian internet (informasi umum, bukan data bengkel):\n";
    hasil.forEach((item, i) => {
        teks += `\n${i + 1}. ${item.judul}${item.sumber ? " (sumber: " + item.sumber + ")" : ""}\n   ${item.cuplikan || "—"}`;
    });
    return teks;
}

module.exports = { cariInternet, formatHasilPencarian };