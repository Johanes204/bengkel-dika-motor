const { keywordProdukUrutan, BULAN_ID } = require("./config");

// ====== DETEKSI INTENT ======
// Menentukan niat pertanyaan user: cariProduk / tambahPelanggan /
// buatJanjiServis / estimasiBiaya / konsultasi.
function deteksiIntent(question) {
    const q = question.toLowerCase();

    // Form janji servis yang diisi & dikirim balik oleh user
    if (/nama\s*[:=].*telepon\s*[:=].*tanggal\s*[:=]/is.test(q)) return "buatJanjiServis";
    if (/form janji servis|formulir janji/i.test(q)) return "buatJanjiServis";

    // Follow-up / pertanyaan referensi ke percakapan sebelumnya → jawab langsung dari riwayat
    const tanyaLanjutan = /(sebelumnya|tadi|kemarin|yang tadi|tadi kan|barusan).*(daftar|booking|janji|servis|pesan|beli|cari|tanya)/i.test(q);
    const kataTanya = /(apa|siapa|kapan|berapa|bagaimana|mana)\b/.test(q);
    const adaTelepon = /(\b08\d{7,13}\b|\b\d{9,15}\b)/.test(q);
    if (tanyaLanjutan && kataTanya && !adaTelepon) return "konsultasi";
    if (kataTanya && /(nama|siapa) (saya|aku)/.test(q) && !adaTelepon) return "konsultasi";

    // Pertanyaan yang mengandung kata biaya/harga/ongkos → estimasi, bukan booking
    const bertanyaBiaya = /biaya|harga|ongkos|perkira[n]?|estimasi|kena /i.test(q);
    if (!bertanyaBiaya && /janji|booking|jadwal(kan|i)? servis|daftar servis|mau servis|ingin servis|bisa servis|servis (motor|matic|bebek|sport|saya)|tanya jadwal|reservasi|kapan (bisa|buka)/i.test(q)) {
        return "buatJanjiServis";
    }

    if (/daftar(kan)? (saya|aku|nama)|tambah (pelanggan|customer|data)|daftar sebagai pelanggan|menjadi pelanggan|mau (daftar|mendaftar|didaftarkan)|bisa daftar|daftar pelanggan|mau jadi pelanggan/i.test(q)) {
        return "tambahPelanggan";
    }

    const adaProduk = keywordProdukUrutan.some(kw => q.includes(kw));
    const aksiProduk = /carikan|cariin|cari |ada |harga|beli|butuh|tersedia|punya|stok|cocok|rekomendasi|info produk|produk (untuk|buat|khusus)|oli (untuk|buat|khusus)|ban (untuk|buat|khusus)|mau (beli|order|pesan)|bagus|enak|merek|merk|rekomen|saran/i.test(q);
    const tanyaProduk = /(produk|oli|ban|busi|aki|sparepart|spare part|onderdil|suku cadang).*(bagus|apa|mana|rekomendasi|saran|cocok)|(bagus|rekomendasi|saran|cocok).*(produk|oli|ban|busi|aki|sparepart|spare part|onderdil|suku cadang)/i.test(q);
    const produkMurni = (adaProduk && aksiProduk) || tanyaProduk;

    // ===== ESTIMASI BIAYA (diuji duluan) =====
    // "berapa biaya servisnya", "perkiraan biaya", "ongkos benerin" → estimasi biaya.
    // Kata "spare part" + "harga" sering muncul juga di pertanyaan ini, jadi cek
    // KATA BIAYA-STRONG (biaya/ongkos/perkiraan/estimasi/kena) dulu sebelum produk.
    const adaBiayaKuat = /biaya|ongkos|perkira[n]?|estimasi|kena /i.test(q);
    const bertanyaBerapa = /\bberapa\b|harga/i.test(q);
    const bukanUkuranWaktu = !/(cc|liter|meter|km|cm|mm|gram|kg|psi|bar|unit|jam|menit|hari|bulan|tahun|waktu|lama)/i.test(q);
    if (bukanUkuranWaktu && (adaBiayaKuat || (bertanyaBerapa && !produkMurni))) {
        if (/servis|service|perbaikan|perbaiki|tune ?up|check|cek|bengkel|benerin|ganti|bayar|kena|biaya|ongkos/i.test(q)) return "estimasiBiaya";
    }

    if (produkMurni) return "cariProduk";
    if (/cari (produk|sparepart|spare part|onderdil|suku cadang)|mau (beli|order|pesan) (produk|oli|ban|busi|aki|sparepart)/i.test(q)) return "cariProduk";

    return "konsultasi";
}

// Ambil keyword produk paling spesifik dari pertanyaan
function ekstrakKeywordProduk(question) {
    const q = question.toLowerCase();
    for (const kw of keywordProdukUrutan) {
        if (q.includes(kw)) return kw;
    }
    return null;
}

// Kumpulkan semua keyword produk yang muncul dalam sebuah teks
function ekstrakKeywordBagian(text) {
    if (!text) return [];
    const t = text.toLowerCase();
    const hasil = [];
    for (const kw of keywordProdukUrutan) {
        if (t.includes(kw)) hasil.push(kw);
    }
    return hasil;
}

// ====== PARSING DATA PELANGGAN / FORM ======
// Mencari nama, telepon, tanggal, alamat dari pesan user —
// mendukung format formulir ("Nama : Budi") maupun kalimat bebas.
function ekstrakParamPelanggan(question) {
    const q = question;
    const result = { nama: null, telepon: null, tanggal: null, alamat: null, keluhan: null };

    // 1) Parsing per-baris (format formulir: "Nama : Budi")
    const lineByLabel = (labels) => {
        for (const line of q.split(/\r?\n/)) {
            const m = line.match(new RegExp(`^\\s*(?:${labels})\\s*[:=]\\s*(.+?)\\s*$`, "i"));
            if (m && m[1].trim() && !/^[_\-\s.]{3,}$/.test(m[1].trim())) return m[1].trim();
        }
        return null;
    };

    const namaBaris = lineByLabel("nama(?: pelanggan| lengkap)?");
    const telpBaris = lineByLabel("telepon|no\\s?hp|nomor\\s?(?:hp|telepon|wa)");
    const tanggalBaris = lineByLabel("tanggal|tanggal servis");
    const alamatBaris = lineByLabel("alamat");
    const keluhanBaris = lineByLabel("keluhan|kerusakan|masalah|gejala");

    if (namaBaris) result.nama = namaBaris;
    if (telpBaris) result.telepon = telpBaris.replace(/[^\d]/g, "");
    if (tanggalBaris) result.tanggal = normalisasiTanggal(tanggalBaris);
    if (alamatBaris) result.alamat = alamatBaris;
    if (keluhanBaris) result.keluhan = keluhanBaris;

    // 2) Fallback: parsing inline (belum terisi → masih baris kosong/underscore)
    if (!result.nama) {
        const namaMatch = q.match(/nama(?: saya| ku|)?[:\s]*([A-Za-z\s.'-]{2,40}?)(?=,|;|telepon|no\s?hp|nomor|tanggal|alamat|$)/i) ||
                          q.match(/(?:saya|aku|atas nama)\s+([A-Za-z\s.'-]{2,40}?)(?=,|;|telepon|no\s?hp|nomor|tanggal|alamat|$)/i);
        if (namaMatch && !/^[_\-\s.]{2,}$/.test(namaMatch[1].trim())) result.nama = namaMatch[1].trim();
    }

    if (!result.telepon) {
        const telpMatch = q.match(/(?:telepon|no\s?hp|nomor)[:\s]*([0-9+\s-]{9,16})/i) ||
                          q.match(/(08[0-9\s-]{8,14})/i);
        if (telpMatch) result.telepon = telpMatch[1].replace(/[^\d]/g, "");
    }

    if (!result.tanggal) {
        const tanggalMatch = q.match(/(\d{4}-\d{2}-\d{2})/) ||
                             q.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/) ||
                             q.match(/(\d{1,2})\s+(jan|peb|feb|mar|mei|apr|jun|jul|aug|agust`?|sep|sept|okt|okto|nov|des)[a-z]*\b(?:\s+(\d{2,4}))?/i) ||
                             q.match(/tanggal\s+(?:hari\s*ini|besok|lusa)/i);
        if (tanggalMatch) result.tanggal = normalisasiTanggal(tanggalMatch[0]);
        // kata relatif tanpa angka (misal: "besok", "hari ini", "lusa")
        if (!result.tanggal && /(besok|lusa|hari\s*ini)/i.test(q)) {
            result.tanggal = normalisasiTanggal(q);
        }
    }

    if (!result.alamat) {
        const alamatMatch = q.match(/alamat[:\s]*([^,;]{5,60})/i);
        if (alamatMatch) result.alamat = alamatMatch[1].trim();
    }

    return result;
}

// ====== NORMALISASI TANGGAL ======
// Menerima berbagai format: YYYY-MM-DD, DD/MM/YYYY, "10 agustus 2026",
// "10 Agustus", "besok", "lusa", "hari ini". Selalu keluarkan YYYY-MM-DD.
function normalisasiTanggal(raw) {
    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        return s.slice(0, 10);
    }
    const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (m) {
        const [, d, mo, y] = m;
        return `${y.length === 2 ? "20" + y : y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    // Format Indonesia: "10 agustus 2026", "10 Agustus", "10 agust 2026"
    const min = s.match(/^(\d{1,2})\s+(jan|peb|feb|mar|mei|apr|jun|jul|aug|agust?|sep|sept|okt|okto|nov|des)[a-z]*\b\s*(\d{2,4})?/i);
    if (min) {
        const [, d, bulanTeks, y] = min;
        let nama = bulanTeks.toLowerCase();
        if (nama === "aug" || nama.startsWith("agust")) nama = "agustus";
        const mo = BULAN_ID[nama] || (
            Object.keys(BULAN_ID).find((k) => k.startsWith(nama.slice(0, 3))) &&
            BULAN_ID[Object.keys(BULAN_ID).find((k) => k.startsWith(nama.slice(0, 3)))]
        );
        if (!mo) return null;
        const tahun = y ? (y.length === 2 ? "20" + y : y) : String(new Date().getFullYear());
        return `${tahun}-${mo}-${d.padStart(2, "0")}`;
    }

    // Kata-kata relatif: hari ini, besok, lusa
    const now = new Date();
    const dd = (n) => {
        const x = new Date(now);
        x.setDate(x.getDate() + n);
        return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    };
    if (/hari\s*ini|sekarang|saat\s*ini|nanti\s*(hari|ini)?/i.test(s)) return dd(0);
    if (/besok|esok/i.test(s)) return dd(1);
    if (/lusa/i.test(s)) return dd(2);

    return null;
}

module.exports = {
    deteksiIntent,
    ekstrakKeywordProduk,
    ekstrakKeywordBagian,
    ekstrakParamPelanggan,
    normalisasiTanggal
};