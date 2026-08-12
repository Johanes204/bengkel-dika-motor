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

// ====== DETEKSI INTENT ADMIN ======
// Khusus AI admin: export data janji servis ke Excel / ubah data produk.
// Kosakata sengaja diperluas agar beragam cara admin meminta data
// ("tolong ambilkan data servis", "kasih file excel bookingan", "siapa yang
// sudah booking?", dst.) tetap dikenali sebagai permintaan ekspor.
function deteksiIntentAdmin(question) {
    const q = question.toLowerCase();

    // ---- UBAH PRODUK (diuji duluan, lebih spesifik) ----
    // Kosakata sengaja diperluas: ubahin, gantiin, rubah, diubah, ngedit,
    // perbarui, revisi, naikkan/turunkan harga, set/atur harga, tambahkan
    // harga/deskripsi, dst. — semuanya merujuk pada mengubah data produk.
    const kataUbah = /(ubah|ubahin|ubahkan|mengubah|rubah|diubah|dirubah|ganti|gantiin|gantikan|mengganti|diganti|edit|ngedit|editin|mengedit|diedit|update|updatin|mengupdate|perbarui|perbaruin|perbaharui|memperbarui|revisi|merevisi|modif|modifikasi|perbaiki|naik(kan|in)?|turun(kan|in)?|set\s+(harga|deskripsi|detail|keterangan|nama)|atur\s+(harga|deskripsi|detail|keterangan|nama)|(?:tambahkan|tambahin?)\s+(?:harga|deskripsi|detail|keterangan)|(?:harga|harganya|harga nya)\s+(?:jadi|menjadi|adalah|sebesar)\b\s*(?:rp\.?\s*)?\d)/i;
    const kataProduk = /\b(produk(?:nya)?|spare[ -]?part(?:nya)?|onderdil(?:nya)?|oli(?:nya)?|ban(?:nya)?|busi(?:nya)?|aki(?:nya)?|shock[ -]?breaker(?:nya)?|sokbreker(?:nya)?|harga(?:nya)?|harga nya|deskripsi(?:nya)?|detail(?:nya)?|keterangan(?:nya)?|spesifikasi(?:nya)?|spek(?:nya)?|nama produk(?:nya)?)\b/i;
    if (kataUbah.test(q) && kataProduk.test(q) &&
        !/(excel|xlsx|file|berkas|ekspor|export|unduh|download|tarik|narik|rekap)/i.test(q)) {
        return "ubahProduk";
    }

    // ---- EKSPOR DATA JANJI SERVIS ----
    // kata yang menandakan file/format excel
    const kataExcel = /\b(excel|xlsx|spreadsheet|file|berkas|tabel)\b/i;
    // kata yang menandakan kumpulan data (dukung akhiran "nya")
    const kataData = /\b(data(?:nya)?|daftar(?:nya)?|list(?:nya)?|rekapan?(?:nya)?|laporan(?:nya)?|informasi|info(?:nya)?|isi|semua)\b/i;
    // kata yang merujuk janji servis / booking (dukung akhiran "nya")
    const kataJanji = /\b(janji ?servis(?:nya)?|janjian(?:nya)?|booking ?servis(?:nya)?|booking(?:nya)?|bookingan(?:nya)?|appointment(?:nya)?|reservasi(?:nya)?|jadwal servis(?:nya)?|schedule(?:nya)?|servis(?:nya)?)\b/i;
    // kata aksi yang menunjukkan permintaan mengambil/membuat/mengirim
    const kataAksi = /(ekspor|export|unduh|download|tarik|narik|ambil|ambilkan|ngambil|rekap|cetak|print|buat|buatin|buatkan|bikin|kasih|kasihin|kirim|kirimin|kirimkan|share|keluarkan|keluarin|tampilkan|tunjukkan|lihatkan|butuh|perlu|minta|mohon|tolong|mau|ingin|pengen|dapat|dapetin|simpan|save|cek|check)/i;
    // kata larangan agar tidak tertangkap pertanyaan biaya/estimasi
    const tanyaBiaya = /(biaya|harga|ongkos|tarif|perkira[n]?|estimasi)/i;

    // 1) Menyebut excel/file + ada data atau servis → pasti ekspor
    if (kataExcel.test(q) && !kataUbah.test(q) && (kataJanji.test(q) || kataData.test(q))) {
        return "exportJanjiServis";
    }
    // 2) Aksi ambil/ekspor/unduh + kata janji servis
    if (!kataUbah.test(q) && kataAksi.test(q) && kataJanji.test(q)) {
        return "exportJanjiServis";
    }
    // 2b) Kata periode (minggu/bulan/tahun) + janji servis → ekspor data periode itu
    if (!kataUbah.test(q) && !tanyaBiaya.test(q) && kataJanji.test(q) &&
        /\b(minggu(?:an| ini|lalu| kemarin)?|bulan(?:an| ini|lalu| kemarin)?|tahun(?:an| ini|lalu| kemarin)?)\b/i.test(q)) {
        return "exportJanjiServis";
    }
    // 3) Kata data + janji servis (tanpa kata aksi) → tetap tawarkan ekspor
    if (!kataUbah.test(q) && kataData.test(q) && kataJanji.test(q) && !tanyaBiaya.test(q)) {
        return "exportJanjiServis";
    }
    // 4) Pertanyaan "siapa/berapa yang servis/booking" → ekspor
    if (!kataUbah.test(q) && !tanyaBiaya.test(q) &&
        /\b(siapa|sapa|berapa|mana)\b/.test(q) && kataJanji.test(q) &&
        /(yang|sudah|mau|akan|banyak|total|semua)/i.test(q)) {
        return "exportJanjiServis";
    }

    return "konsultasi";
}

// ====== PARSING PERUBAHAN PRODUK (AI admin) ======
// Mendukung beragam cara admin meminta perubahan: "ubah deskripsi produk X menjadi Y",
// "ganti harga produknya jadi 45000", "ubahin harganya Rp. 50.000", "update detail
// produk dengan id 3", "set harga produk Y sebesar 40000", "turunkan harga id 2 jadi 35000",
// "ganti deskripsi nomor 4 jadi ...", dst.
// Mencari ID (id/nomor/kode, boleh "id nya 3") lalu fallback ke nama produk.
function ekstrakParamUbahProduk(question) {
    const q = question;
    const result = { id: null, nama: null, name_product: null, detail_product: null, price_product: null };

    const produkToken = `(?:produk|spare[ -]?part|onderdil|oli|ban|busi|aki|shock[ -]?breaker|sokbreker)`;
    const label = "deskripsi|detail|keterangan|spesifikasi|spek";

    // ID: "id 3", "id:3", "id#3", "id-3", "id=3", "id nya 3", "nomor 3", "kode 3", "id produk 3"
    const mId = q.match(/\b(?:id|nomor|no|kode)(?:nya)?\s*[:#=\-]?\s*(?:produk(?:nya)?\s*)?(\d+)\b/i);
    if (mId) result.id = Number(mId[1]);

    if (!result.id) {
        // Nama produk setelah kata "produk/oli/ban/..." — berhenti bila yang muncul
        // justru kata "menjadi/jadi/harga/dengan id/dst." (berarti tidak ada nama),
        // dan tolak bila nama itu ternyata bagian dari deskripsi ("menjadi oli ...").
        const targetMatch = q.match(new RegExp(`(?<!menjadi )(?<!jadi )(?<!adalah )(?<!sebesar )(?<!sebanyak )((?:${produkToken})(?:nya)?)[^\\w]+\\s*(?!(?:menjadi|jadi|adalah|sebesar|sebanyak|deskripsi|detail|keterangan|harganya|harga nya|harga|nama|(?:id|nomor|no|kode)(?:nya)?)\\b)([A-Za-z0-9][A-Za-z0-9\\s.\\/&-]{1,60}?)(?=,|;|\\.\\s|\\s+(?:menjadi|jadi|adalah|sebesar|sebanyak)|\\s+(?:dengan\\s+)?id\\b|deskripsi|harga|harganya|harga nya|nama|\\n|$)`, "i"));
        if (targetMatch) {
            const lexeme = targetMatch[1];
            const namaBagian = targetMatch[2].trim();
            // "oli" + "matic" → "oli matic"; "produk" + "oli matic" → "oli matic"
            result.nama = (lexeme === "produk" || lexeme.endsWith("nya")) ? namaBagian : `${lexeme} ${namaBagian}`;
        }
    }

    // Hentian capture agar kalimat gabungan ("... menjadi X dan harga menjadi 5000")
    // tidak saling menelan: berhenti sebelum kata harga/deskripsi berikutnya.
    const stop = `(?=,|;|\\.\\s|\\s+(?:menjadi|jadi|adalah|sebesar|sebanyak)\\b|\\s+(?:harga|harganya|harga nya)\\b|\\s+(?:dan|serta)\\s+(?:harga|harganya|harga nya|nama)\\b|\\n|$)`;

// (1) "deskripsi produk X menjadi Y", "deskripsi dengan id 3 menjadi Y",
    //     "deskripsi nomor 4 jadi Y", "deskripsi menjadi Y" → ambil Y
    //     (nilai tidak boleh diawali angka — itu biasanya harga, bukan deskripsi)
    const ruasMarker = new RegExp(`\\b(?:${label})(?:nya)?\\s*(?:(?:${produkToken})(?:nya)?\\b\\s+|(?:id|nomor|no|kode)\\s*\\d+\\b\\s+)?[^,;]{0,60}?\\s*(?:menjadi|jadi|adalah|sebesar|sebanyak)\\s+(?!\\d)(.+?)\\s*${stop}`, "i");
    // (2) "deskripsi: Y" / "deskripsi = Y" / "deskripsi menjadi: Y"
    const ruasColon = new RegExp(`\\b(?:${label})(?:nya)?\\s*(?:menjadi|jadi|adalah|sebesar|sebanyak)?\\s*[:=]\\s*(.+?)\\s*${stop}`, "i");
    // (3) "deskripsi X" langsung tanpa "jadi" — hanya jika X bukan kata produk/id
    const ruasLangsung = new RegExp(`\\b(?:${label})(?:nya)?\\s+(?!(?:${produkToken})(?:nya)?\\b|(?:id|nomor|no|kode)(?:nya)?\\b)(.+?)\\s*${stop}`, "i");

    const ekstrakSetelah = (ruas, ruasC, ruasL) => {
        const m1 = ruas.exec(q);
        if (m1) return m1[1].trim();
        const m2 = ruasC.exec(q);
        if (m2) return m2[1].trim();
        const m3 = ruasL.exec(q);
        if (m3) return m3[1].trim();
        return null;
    };

    result.detail_product = ekstrakSetelah(ruasMarker, ruasColon, ruasLangsung);

    // Harga: dukung "ubah harga produk X menjadi 45000", "harganya jadi Rp. 50.000",
    // "harga nya 45.000", "set harga produknya sebesar 50000", "turunkan harga id 2 jadi 35000",
    // "harga produk dengan id 3 menjadi 55000".
    const mHarga1 = q.match(new RegExp(`(?:harga|harganya|harga nya)\\s*(?:dan\\s+\\w+\\s+)?(?:${produkToken})(?:nya)?\\b\\s+[^,;]{1,60}?\\s+(?:menjadi|jadi|adalah|sebesar|sebanyak)\\s+(?:rp\\.?\\s*)?(\\d[\\d.,]{1,})`, "i"));
    const mHarga2 = q.match(new RegExp(`(?:harga|harganya|harga nya)\\s*(?:(?:(?:${produkToken})(?:nya)?|(?:id|nomor|no|kode)(?:nya)?\\s*[:#=\\-]?\\s*\\d+)\\s*)?(?:menjadi|jadi|adalah|sebesar|sebanyak|[:=])?\\s*[:=]?\\s*(?:rp\\.?\\s*)?(\\d[\\d.,]{1,})`, "i"));
    if (mHarga1) result.price_product = mHarga1[1];
    else if (mHarga2) result.price_product = mHarga2[1];

    const namaLabel = "nama (?:produk|baru)?";
    const ruasMarkerNama = new RegExp(`\\b(?:${namaLabel})(?:nya)?\\s*(?:(?:${produkToken})(?:nya)?\\b\\s+|(?:id|nomor|no|kode)\\s*\\d+\\b\\s+)?[^,;]{0,60}?\\s*(?:menjadi|jadi|adalah|sebesar|sebanyak)\\s+(?!\\d)(.+?)\\s*${stop}`, "i");
    const ruasColonNama = new RegExp(`\\b(?:${namaLabel})(?:nya)?\\s*(?:menjadi|jadi|adalah|sebesar|sebanyak)?\\s*[:=]\\s*(.+?)\\s*${stop}`, "i");
    const ruasLangsungNama = new RegExp(`\\b(?:${namaLabel})(?:nya)?\\s+(?!(?:${produkToken})(?:nya)?\\b|(?:id|nomor|no|kode)(?:nya)?\\b)(.+?)\\s*${stop}`, "i");
    result.name_product = ekstrakSetelah(ruasMarkerNama, ruasColonNama, ruasLangsungNama);

    return result;
}

module.exports = {
    deteksiIntent,
    deteksiIntentAdmin,
    ekstrakKeywordProduk,
    ekstrakKeywordBagian,
    ekstrakParamPelanggan,
    ekstrakParamUbahProduk,
    normalisasiTanggal
};