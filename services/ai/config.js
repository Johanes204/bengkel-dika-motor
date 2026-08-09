const fs = require("fs");
const path = require("path");

// ====== OLLAMA ======
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";

// ====== BATAS UMUM ======
const MAX_LOOP = 4;                    // maksimal iterasi agent loop
const MAX_MESSAGES = 20;               // maksimum pesan riwayat yang dikirim ke model
const MAX_SESSIONS = 100;              // maksimum sesi tersimpan di memori
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 jam

// ====== DATASET KERUSAKAN MOTOR (RAG) ======
const datasetPath = path.join(__dirname, "..", "..", "data", "kerusakan_motor.json");
let dataset = [];
try {
    dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
} catch (err) {
    console.error("[config] Gagal load dataset:", err);
}

// ====== STOP WORDS (tokenisasi) ======
const stopWords = new Set([
    "yang", "dan", "di", "ke", "dari", "pada", "dengan", "ini", "itu",
    "saya", "kamu", "aku", "dia", "mereka", "kami", "anda", "tolong",
    "apa", "bagaimana", "kenapa", "mengapa", "apakah", "sudah", "telah",
    "akan", "sedang", "lagi", "tidak", "bisa", "dapat", "untuk", "agar",
    "supaya", "saat", "ketika", "setelah", "sebelum", "karena", "sebab",
    "saja", "juga", "atau", "tapi", "namun", "oleh", "sebagai", "secara",
    "sangat", "semua", "seperti", "adalah", "merupakan", "ada", "adanya"
]);

// ====== KEYWORD OTOMOTIF ======
const keywordMotor = [
    "motor", "mesin", "ban", "oli", "rem", "kopling", "rantai", "aki",
    "busi", "karburator", "injektor", "sparepart", "velg", "gear", "transmisi",
    "servis", "bensin", "stater", "speedometer", "lampu", "sein", "klakson",
    "knalpot", "piston", "silinder", "gasket", "bearing", "pengapian", "cdi",
    "koil", "spul", "kiprok", "filter", "kabel", "sokbreker", "shockbreaker",
    "cv belt", "roller", "pully", "clutch", "tune up", "overhaul", "seher",
    "klep", "noken as", "throttle body", "ecu", "skotlet", "spion",
    "brebet", "tersendat", "ngempos", "bengkel", "montir", "dika motor",
    "booking servis", "janji servis", "jadwal servis", "perawatan motor",
    "kampas rem", "master rem", "ban tubles", "ban dalam", "ban luar",
    "lubricant", "gemuk", "shock belakang"
];

const nonAutomotivePatterns = [
    /politik|presiden|partai|pemilu|korupsi/i,
    /agama|tuhan|nabi|surga|neraka|dosa/i,
    /film|drama|sinetron|artis|selebriti/i,
    /game|permainan|dota|mobile legend|free fire|pubg/i,
    /covid|virus|penyakit|sakit kepala|demam|flu/i,
    /matematika|fisika|kimia|sejarah|biologi|bahasa (asing|inggris)|translate|terjemah/i,
    /hoka ?hoka|bento|restoran|ramen|burger|kfc|mcd|makanan|nasi goreng|soto|bakso|sate|kopi |teh |jus |minuman|makan$/i,
    /investasi|saham|crypto|forex|trading/i,
    /\b(?:ber)?kencan(?!g)\b|cinta|pacaran|romantis/i,
    /matahari|planet|bulan|bintang|gravitasi|cuaca|hujan ?deras/i,
    /menulis|mengarang|pengarang|penulis|novel|buku|cerita/,
    /negara|ibukota|benua|samudra|laut|sungai|gunung|perang|sepak bola|bola$/i,
    /hewan|burung|kucing|anjing|ikan|pohon|bunga|tanaman/i,
    /warna|pelangi|seni|lukis|musik|lagu|penyanyi/i,
    /rahasia|misteri|mitos|legenda|dongeng|hantu/i,
    /toko online|online shop|shopee|tokopedia|lazada|e-?commerce/i,
    /sewa (kontrakan|rumah|apartemen)|kpr|dp rumah/i,
    /tarif (grab|gocar|ojol)|ojek online/i
];

const kataKunciPositif = [
    "motor", "mesin", "oli", "ban", "rem", "busi", "aki",
    "sparepart", "bengkel", "servis", "perbaiki", "rusak",
    "bunyi", "macet", "mati", "panas", "bocor", "ganti",
    "harga", "produk", "booking", "janji", "daftar",
    "konsultasi", "tanya", "kerusakan", "gejala"
];

const keywordProdukUrutan = [
    "oli mesin", "oli gear", "oli cvt", "oli gardan", "minyak rem", "minyak kopling",
    "cv belt", "belt cvt", "v-belt", "kampas rem", "kampas kopling", "filter udara",
    "filter oli", "gear set", "suku cadang", "spare part", "sparepart", "onderdil",
    "shockbreaker", "sokbreker", "shock belakang", "noken as", "oli", "ban", "busi",
    "aki", "kampas", "velg", "lampu", "klakson", "knalpot", "filter", "roller",
    "bearing", "gasket", "seal", "rantai", "gear", "lubricant", "gemuk", "kabel",
    "spion", "kopling", "cakram", "tromol", "piston", "seher", "klep", "cdi",
    "koil", "spul", "kiprok", "shockbreaker tabung"
];

// ====== NAMA BULAN INDONESIA (parsing tanggal) ======
const BULAN_ID = {
    januari: "01", pebruari: "02", februari: "02", maret: "03", april: "04",
    mei: "05", juni: "06", juli: "07", agustus: "08", agust: "08", sep: "09",
    september: "09", oktober: "10", okto: "10", november: "11", des: "12",
    desember: "12"
};

// ====== TEMPLAT FORM JANJI SERVIS ======
const FORM_JANJI_SERVIS = `Tentu, silakan isi formulir janji servis berikut. **Klik tombol Salin**, isi bagian yang kosong, lalu kirim kembali pesan tersebut kepada saya.

\`\`\`form
📋 FORM JANJI SERVIS — Bengkel Dika Motor
Nama : ______________
Telepon : ______________
Tanggal : ______________ (contoh: 2026-08-10)
Keluhan : ______________ (opsional)
\`\`\``;

module.exports = {
    OLLAMA_URL,
    MODEL,
    MAX_LOOP,
    MAX_MESSAGES,
    MAX_SESSIONS,
    SESSION_TTL_MS,
    dataset,
    stopWords,
    keywordMotor,
    nonAutomotivePatterns,
    kataKunciPositif,
    keywordProdukUrutan,
    BULAN_ID,
    FORM_JANJI_SERVIS
};