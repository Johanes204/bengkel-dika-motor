const axios = require("axios");
const fs = require("fs");
const path = require("path");
const cariProduk = require("../tools/cariProduk");
const tambahPelanggan = require("../tools/tambahPelanggan");
const buatJanjiServis = require("../tools/buatJanjiServis");

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";
const MAX_LOOP = 4;
const MAX_MESSAGES = 20;
const MAX_SESSIONS = 100;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const datasetPath = path.join(__dirname, "..", "data", "kerusakan_motor.json");
let dataset = [];
try {
    dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
} catch (err) {
    console.error("Gagal load dataset:", err);
}

const stopWords = new Set([
    "yang", "dan", "di", "ke", "dari", "pada", "dengan", "ini", "itu",
    "saya", "kamu", "aku", "dia", "mereka", "kami", "anda", "tolong",
    "apa", "bagaimana", "kenapa", "mengapa", "apakah", "sudah", "telah",
    "akan", "sedang", "lagi", "tidak", "bisa", "dapat", "untuk", "agar",
    "supaya", "saat", "ketika", "setelah", "sebelum", "karena", "sebab",
    "saja", "juga", "atau", "tapi", "namun", "oleh", "sebagai", "secara",
    "sangat", "semua", "seperti", "adalah", "merupakan", "ada", "adanya"
]);

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
    /resep masakan|makanan|minuman|masak/i,
    /covid|virus|penyakit/i,
    /matematika|fisika|kimia|sejarah|biologi/i,
    /investasi|saham|crypto|forex/i,
    /kencan|cinta|pacaran|romantis/i,
    /matahari|planet|bulan|bintang|gravitasi/i,
    /menulis|mengarang|pengarang|penulis|novel|buku/i,
    /negara|ibukota|benua|samudra|laut|sungai|gunung/i,
    /hewan|tumbuhan|binatang|tanaman|pohon|bunga/i,
    /warna|pelangi|seni|lukis|musik|lagu|penyanyi/i,
    /rahasia|misteri|mitos|legenda|dongeng/i
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

    if (/janji|booking|jadwal(kan|i)? servis|daftar servis|mau servis|ingin servis|bisa servis|servis (motor|matic|bebek|sport|saya)|tanya jadwal|reservasi|kapan (bisa|buka)/i.test(q)) {
        return "buatJanjiServis";
    }

    if (/daftar(kan)? (saya|aku|nama)|tambah (pelanggan|customer|data)|daftar sebagai pelanggan|menjadi pelanggan|mau (daftar|mendaftar|didaftarkan)|bisa daftar|daftar pelanggan|mau jadi pelanggan/i.test(q)) {
        return "tambahPelanggan";
    }

    const adaProduk = keywordProdukUrutan.some(kw => q.includes(kw));
    const aksiProduk = /carikan|cariin|cari |ada |harga|beli|butuh|tersedia|punya|stok|cocok|rekomendasi|info produk|produk (untuk|buat|khusus)|oli (untuk|buat|khusus)|ban (untuk|buat|khusus)|mau (beli|order|pesan)|bagus|enak|merek|merk|rekomen|saran/i.test(q);
    const tanyaProduk = /(produk|oli|ban|busi|aki|sparepart|spare part|onderdil|suku cadang).*(bagus|apa|mana|rekomendasi|saran|cocok)|(bagus|rekomendasi|saran|cocok).*(produk|oli|ban|busi|aki|sparepart|spare part|onderdil|suku cadang)/i.test(q);

    if ((adaProduk && aksiProduk) || tanyaProduk) return "cariProduk";
    if (/cari (produk|sparepart|spare part|onderdil|suku cadang)|mau (beli|order|pesan) (produk|oli|ban|busi|aki|sparepart)/i.test(q)) return "cariProduk";

    return "konsultasi";
}

function ekstrakKeywordProduk(question) {
    const q = question.toLowerCase();
    for (const kw of keywordProdukUrutan) {
        if (q.includes(kw)) return kw;
    }
    return null;
}

function ekstrakParamPelanggan(question) {
    const q = question;
    const result = { nama: null, telepon: null, tanggal: null, alamat: null };

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

    if (namaBaris) result.nama = namaBaris;
    if (telpBaris) result.telepon = telpBaris.replace(/[^\d]/g, "");
    if (tanggalBaris) result.tanggal = normalisasiTanggal(tanggalBaris);
    if (alamatBaris) result.alamat = alamatBaris;

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
                             q.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/);
        if (tanggalMatch) result.tanggal = normalisasiTanggal(tanggalMatch[1]);
    }

    if (!result.alamat) {
        const alamatMatch = q.match(/alamat[:\s]*([^,;]{5,60})/i);
        if (alamatMatch) result.alamat = alamatMatch[1].trim();
    }

    return result;
}

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
    return null;
}

const FORM_JANJI_SERVIS = `Tentu, silakan isi formulir janji servis berikut. **Klik tombol Salin**, isi bagian yang kosong, lalu kirim kembali pesan tersebut kepada saya.

\`\`\`form
📋 FORM JANJI SERVIS — Bengkel Dika Motor
Nama : ______________
Telepon : ______________
Tanggal : ______________ (contoh: 2026-08-10)
Keluhan : ______________ (opsional)
\`\`\``;

const TOOL_DEFINITIONS = [
    {
        type: "function",
        function: {
            name: "cariProduk",
            description: "Cari produk/sparepart/oli yang tersedia di Bengkel Dika Motor berdasarkan keyword (misal: oli, busi, shockbreaker, ban, aki). Gunakan tool ini setiap kali user bertanya tentang produk, harga, atau rekomendasi produk/oli/ban.",
            parameters: {
                type: "object",
                properties: {
                    keyword: {
                        type: "string",
                        description: "Keyword produk yang dicari, contoh: 'oli', 'busi', 'shockbreaker'"
                    }
                },
                required: ["keyword"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "tambahPelanggan",
            description: "Daftarkan pelanggan baru ke database Bengkel Dika Motor. Hanya panggil jika nama dan telepon sudah diketahui.",
            parameters: {
                type: "object",
                properties: {
                    nama: { type: "string", description: "Nama pelanggan" },
                    telepon: { type: "string", description: "Nomor telepon pelanggan" },
                    alamat: { type: "string", description: "Alamat pelanggan (opsional)" }
                },
                required: ["nama", "telepon"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "buatJanjiServis",
            description: "Buat janji servis di Bengkel Dika Motor. Hanya panggil jika nama, telepon, dan tanggal sudah lengkap.",
            parameters: {
                type: "object",
                properties: {
                    nama: { type: "string", description: "Nama pemilik motor" },
                    telepon: { type: "string", description: "Nomor telepon" },
                    tanggal: { type: "string", description: "Tanggal servis format YYYY-MM-DD" },
                    keluhan: { type: "string", description: "Keluhan/kerusakan motor (opsional)" }
                },
                required: ["nama", "telepon", "tanggal"]
            }
        }
    }
];

const TOOL_HANDLERS = {
    cariProduk,
    tambahPelanggan,
    buatJanjiServis
};

// ====== NATIVE TOOLS SUPPORT (probe) ======
let nativeToolsSupported = null;

async function checkNativeTools() {
    if (nativeToolsSupported !== null) return nativeToolsSupported;
    try {
        await axios.post(`${OLLAMA_URL}/api/chat`, {
            model: MODEL,
            messages: [{ role: "user", content: "halo" }],
            tools: TOOL_DEFINITIONS,
            stream: false,
            options: { num_predict: 5 }
        }, { timeout: 30000 });
        nativeToolsSupported = true;
    } catch (err) {
        const msg = err.response?.data?.error || "";
        nativeToolsSupported = !/does not support tools/i.test(msg);
        if (!nativeToolsSupported) {
            console.log(`[AI] Model ${MODEL} tidak mendukung native tools → pakai fallback prompt-based tool calling`);
        }
    }
    return nativeToolsSupported;
}

function parseToolCall(text) {
    if (!text) return null;

    const idx = text.indexOf("TOOL_CALL:");
    let jsonStart;
    if (idx !== -1) {
        jsonStart = text.indexOf("{", idx);
        if (jsonStart === -1) return null;
    } else {
        const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
        if (!trimmed.startsWith("{")) return null;
        jsonStart = 0;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = jsonStart; i < text.length; i++) {
        const ch = text[i];
        if (escaped) { escaped = false; continue; }
        if (ch === "\\") { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) {
                try {
                    return JSON.parse(text.slice(jsonStart, i + 1));
                } catch {
                    return null;
                }
            }
        }
    }
    return null;
}

// ====== SESSION MEMORY ======
const sessions = new Map();

function pruneSessions() {
    const now = Date.now();
    for (const [id, session] of sessions) {
        if (now - session.lastActive > SESSION_TTL_MS) sessions.delete(id);
    }
    if (sessions.size > MAX_SESSIONS) {
        const sorted = [...sessions.entries()].sort((a, b) => a[1].lastActive - b[1].lastActive);
        for (let i = 0; i < sorted.length - MAX_SESSIONS; i++) sessions.delete(sorted[i][0]);
    }
}

function getSession(sessionId) {
    pruneSessions();
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, { messages: [], title: "", lastActive: Date.now() });
    }
    return sessions.get(sessionId);
}

function resetSession(sessionId) {
    sessions.delete(sessionId);
}

function getSessionHistory(sessionId) {
    const session = sessions.get(sessionId);
    return session ? session.messages.slice(-MAX_MESSAGES) : [];
}

function listSessions() {
    return [...sessions.entries()].map(([id, s]) => ({
        id,
        title: s.title || "Percakapan baru",
        lastActive: s.lastActive
    }));
}

// ====== RAG (data kerusakan) ======
function tokenize(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w));
}

function cariRelevan(question, maxHasil = 5) {
    const kataKunci = tokenize(question);
    return dataset.map(item => {
        const gejalaTokens = tokenize(item.gejala);
        const penyebabTokens = tokenize(item.penyebab);
        const solusiTokens = tokenize(item.solusi);
        let score = 0;
        for (const kata of kataKunci) {
            if (gejalaTokens.some(t => t.includes(kata) || kata.includes(t))) score += 3;
            if (penyebabTokens.some(t => t.includes(kata) || kata.includes(t))) score += 2;
            if (solusiTokens.some(t => t.includes(kata) || kata.includes(t))) score += 1;
        }
        return { ...item, score };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, maxHasil);
}

function formatDatasetContext(hasil) {
    if (hasil.length === 0) return "";
    let context = "\nData kerusakan relevan dari database bengkel:\n";
    hasil.forEach((item, i) => {
        context += `\n${i + 1}. Gejala: "${item.gejala}"\n   Penyebab: ${item.penyebab}\n   Solusi: ${item.solusi}`;
    });
    return context;
}

function isAutomotiveQuestion(question) {
    const lower = question.toLowerCase();
    for (const pattern of nonAutomotivePatterns) {
        if (pattern.test(question)) return false;
    }
    for (const kw of keywordMotor) {
        if (lower.includes(kw)) return true;
    }
    const tokens = tokenize(question);
    let matchCount = 0;
    for (const kata of tokens) {
        if (kataKunciPositif.some(k => k.includes(kata) || kata.includes(k))) matchCount++;
    }
    return matchCount >= 2;
}

// ====== OLLAMA STREAMING ======
function readOllamaStream(stream, onChunk) {
    return new Promise((resolve, reject) => {
        let buffer = "";
        stream.on("data", (chunk) => {
            buffer += chunk.toString("utf8");
            let idx;
            while ((idx = buffer.indexOf("\n")) !== -1) {
                const line = buffer.slice(0, idx).trim();
                buffer = buffer.slice(idx + 1);
                if (line) onChunk(line);
            }
        });
        stream.on("end", () => {
            if (buffer.trim()) onChunk(buffer.trim());
            resolve();
        });
        stream.on("error", reject);
    });
}

async function callOllama(body, { native, onEvent }) {
    if (!native) {
        const res = await axios.post(`${OLLAMA_URL}/api/chat`, body, { timeout: 120000 });
        const content = res.data.message?.content || "";
        const toolCall = parseToolCall(content);
        const toolCalls = toolCall && toolCall.tool
            ? [{ function: { name: toolCall.tool, arguments: toolCall.params || {} } }]
            : [];
        return { content, toolCalls };
    }

    let content = "";
    const toolCalls = [];

    try {
        const res = await axios.post(`${OLLAMA_URL}/api/chat`, body, {
            responseType: "stream",
            timeout: 120000
        });

        await readOllamaStream(res.data, (line) => {
            let json;
            try {
                json = JSON.parse(line);
            } catch {
                return;
            }
            const msg = json.message || {};
            if (msg.content) {
                content += msg.content;
                onEvent({ type: "token", content: msg.content });
            }
            if (Array.isArray(msg.tool_calls)) {
                for (const tc of msg.tool_calls) {
                    if (!tc.function) continue;
                    const existing = toolCalls.some(
                        (t) => t.function.name === tc.function.name &&
                            JSON.stringify(t.function.arguments) === JSON.stringify(tc.function.arguments)
                    );
                    if (!existing) toolCalls.push(tc);
                }
            }
        });

        // Fallback: model kadang menulis JSON tool call sebagai teks biasa
        if (toolCalls.length === 0 && content.trim().startsWith("{")) {
            const parsed = parseToolCall(content);
            if (parsed && parsed.tool) {
                toolCalls.push({ function: { name: parsed.tool, arguments: parsed.params || {} } });
            }
        }
    } catch (err) {
        const detail = err.response?.data?.error || err.message || "";
        if (/connect|ECONNREFUSED/i.test(detail)) {
            throw new Error("Ollama belum berjalan. Silakan jalankan Ollama terlebih dahulu.");
        }
        throw new Error("Gagal terhubung ke Ollama: " + detail.substring(0, 120));
    }

    return { content, toolCalls };
}

async function executeTool(toolName, args) {
    const handler = TOOL_HANDLERS[toolName];
    if (!handler) return `Error: tool "${toolName}" tidak dikenal.`;
    try {
        return String(await handler(args || {}));
    } catch (err) {
        return `Error saat menjalankan ${toolName}: ${err.message}`;
    }
}

function buildSystemPrompt({ intent, datasetContext, isNewChat, riwayat }) {
    let prompt = `Kamu adalah AI Agent resmi Bengkel Dika Motor, bengkel motor di Indonesia.
TUGAS:
- Konsultasi kerusakan motor (jawab langsung berdasarkan data bengkel)
- Cari produk/sparepart (WAJIB pakai tool cariProduk)
- Daftarkan pelanggan baru (pakai tool tambahPelanggan)
- Buat janji servis (pakai tool buatJanjiServis)

BATASAN:
- HANYA menjawab pertanyaan tentang motor, otomotif, servis, sparepart, dan perawatan kendaraan
- Pertanyaan di luar itu (politik, agama, hiburan, dll) tolak dengan sopan
- Gunakan Bahasa Indonesia yang ramah dan natural`;

    if (datasetContext && intent === "konsultasi") {
        prompt += "\n\nGunakan data kerusakan berikut jika relevan:\n" + datasetContext;
    }
    if (riwayat) {
        prompt += "\n\nRIWAYAT PERCAKAPAN SEBELUMNYA:\n" + riwayat;
    }

    prompt += `

PANDUAN TOOL:
- User bertanya tentang produk, harga, atau rekomendasi (oli, ban, busi, shockbreaker, dll) → panggil cariProduk dengan keyword yang tepat (contoh: "oli", "busi", "shockbreaker").
- User minta daftar pelanggan → panggil tambahPelanggan jika nama dan telepon ada; jika belum, tanyakan dulu.
- User mau booking servis → panggil buatJanjiServis jika nama, telepon, tanggal ada; jika belum, tanyakan dulu.
- Untuk konsultasi kerusakan, jawab langsung tanpa tool.

Jika tool gagal atau tidak menemukan hasil, tetap jawab dengan sopan dan tawarkan alternatif.`;

    return prompt;
}

async function chat(sessionId, question, onEvent = () => {}) {
    if (!question || !question.trim()) {
        onEvent({ type: "token", content: "Silakan ketik pertanyaan Anda." });
        return "Silakan ketik pertanyaan Anda.";
    }

    const session = getSession(sessionId);
    const isNewChat = session.messages.length === 0;
    const intent = deteksiIntent(question);

    if (isNewChat && intent === "konsultasi" && !isAutomotiveQuestion(question)) {
        const msg = "Maaf, saya hanya bisa membantu pertanyaan seputar motor, servis, sparepart, dan perawatan kendaraan. Silakan tanya seputar bengkel Dika Motor.";
        session.messages.push({ role: "user", content: question }, { role: "assistant", content: msg });
        session.title = question.slice(0, 40);
        onEvent({ type: "token", content: msg });
        return msg;
    }

    const hasilRelevan = cariRelevan(question);
    const datasetContext = intent === "konsultasi" ? formatDatasetContext(hasilRelevan) : "";

    // Booking servis: jika data belum lengkap, tampilkan form yang bisa di-copy & diisi user
    if (intent === "buatJanjiServis") {
        const dataBooking = ekstrakParamPelanggan(question);
        if (!(dataBooking.nama && dataBooking.telepon && dataBooking.tanggal)) {
            session.messages.push({ role: "user", content: question }, { role: "assistant", content: FORM_JANJI_SERVIS });
            if (!session.title) session.title = question.slice(0, 40);
            session.lastActive = Date.now();
            onEvent({ type: "token", content: FORM_JANJI_SERVIS });
            return FORM_JANJI_SERVIS;
        }
    }

    const riwayat = session.messages.slice(-10)
        .map(m => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
        .join("\n");

    const systemPrompt = buildSystemPrompt({ intent, datasetContext, isNewChat, riwayat });

    const messages = [
        { role: "system", content: systemPrompt },
        ...session.messages.slice(-MAX_MESSAGES),
        { role: "user", content: question }
    ];

    const native = await checkNativeTools();

    let finalAnswer = "";
    let toolResults = [];
    let pendingTool = null;

    const runFormattingPass = async (results) => {
        const fmt = results.map(r => `— Tool ${r.name}: ${r.result}`).join("\n\n");
        const formatMessages = [
            { role: "system", content: buildSystemPrompt({ intent, datasetContext, isNewChat, riwayat }) },
            ...session.messages.slice(-MAX_MESSAGES),
            { role: "user", content: question },
            { role: "assistant", content: "Saya akan mencari informasi tersebut." },
            { role: "user", content: `Hasil tool:\n${fmt}\n\nBuatkan jawaban yang natural dan informatif kepada user berdasarkan hasil tool di atas.

ATURAN WAJIB:
1. JANGAN menambahkan informasi, produk, harga, atau pernyataan yang TIDAK ada di hasil tool.
2. Jangan menyebut kata "tool", "database", atau istilah teknis internal.
3. Untuk booking servis / pendaftaran pelanggan: cukup konfirmasi bahwa data sudah tercatat beserta detailnya.
4. Untuk pencarian produk: tampilkan nama, harga, dan detail produk.` }
        ];
        try {
            const final = await callOllama({
                model: MODEL,
                messages: formatMessages,
                stream: native,
                options: { temperature: 0.2, num_ctx: 4096 }
            }, { native, onEvent });
            return final.content.trim();
        } catch (err) {
            return `Berikut hasilnya:\n\n${fmt}`;
        }
    };

    for (let i = 0; i < MAX_LOOP; i++) {
        const body = {
            model: MODEL,
            messages,
            options: { temperature: 0.2, num_ctx: 4096 }
        };

        if (native) {
            if (intent !== "konsultasi") body.tools = TOOL_DEFINITIONS;
            body.stream = true;
            if (i === 0 && intent === "cariProduk") {
                body.tool_choice = { type: "function", function: { name: "cariProduk" } };
            }
        } else {
            body.stream = false;
        }

        let response;
        try {
            response = await callOllama(body, { native, onEvent });
        } catch (err) {
            const msg = err.message.includes("Ollama")
                ? err.message
                : "Maaf, terjadi kesalahan pada AI. " + err.message;
            session.messages.push({ role: "user", content: question }, { role: "assistant", content: msg });
            session.title = question.slice(0, 40);
            onEvent({ type: "token", content: msg });
            return msg;
        }

        if (response.toolCalls.length === 0) {
            finalAnswer = response.content.trim();
            break;
        }

        // Tool dipanggil → eksekusi semua, lalu break loop.
        // (Jawaban akhir diproduksi lewat formatting pass agar kualitas konsisten)
        for (const tc of response.toolCalls) {
            const name = tc.function.name;
            const args = tc.function.arguments || {};
            onEvent({ type: "tool_start", name });
            const result = await executeTool(name, args);
            onEvent({ type: "tool_done", name, result });
            toolResults.push({ name, result });
        }
        break;
    }

    // ====== FORCED TOOL ROUTING ======
    // Jika model tidak memanggil tool padahal intent jelas, eksekusi tool secara
    // deterministik lalu minta model merangkum hasil tool.
    if (toolResults.length === 0 && intent !== "konsultasi") {
        pendingTool = intent;

        if (pendingTool === "cariProduk") {
            const keyword = ekstrakKeywordProduk(question);
            if (keyword) {
                const result = await executeTool("cariProduk", { keyword });
                toolResults.push({ name: "cariProduk", result });
            } else {
                finalAnswer = "Bisa sebutkan produk atau sparepart apa yang ingin Anda cari? Contoh: carikan produk oli untuk motor matic.";
            }
        } else if (pendingTool === "buatJanjiServis") {
            const data = ekstrakParamPelanggan(question);
            if (data.nama && data.telepon && data.tanggal) {
                const result = await executeTool("buatJanjiServis", data);
                toolResults.push({ name: "buatJanjiServis", result });
            } else {
                finalAnswer = FORM_JANJI_SERVIS;
            }
        } else if (pendingTool === "tambahPelanggan") {
            const data = ekstrakParamPelanggan(question);
            if (data.nama && data.telepon) {
                const result = await executeTool("tambahPelanggan", data);
                toolResults.push({ name: "tambahPelanggan", result });
            } else {
                finalAnswer = "Tentu, saya bantu daftarkan sebagai pelanggan. Mohon lengkapi: nama dan nomor telepon Anda. Contoh: daftarkan saya nama Budi, telepon 081234567890.";
            }
        }
    }

    if (toolResults.length > 0) {
        for (const tr of toolResults) {
            onEvent({ type: "tool_start", name: tr.name });
            onEvent({ type: "tool_done", name: tr.name, result: tr.result });
        }
        finalAnswer = await runFormattingPass(toolResults);
    }

    if (!finalAnswer || finalAnswer === "" || finalAnswer === "Maaf, tidak bisa memproses permintaan.") {
        if (intent === "buatJanjiServis") {
            finalAnswer = FORM_JANJI_SERVIS;
        } else if (intent === "tambahPelanggan") {
            finalAnswer = "Tentu, saya bantu daftarkan sebagai pelanggan. Mohon lengkapi: nama dan nomor telepon Anda. Contoh: daftarkan saya nama Budi, telepon 081234567890.";
        } else {
            finalAnswer = "Maaf, tidak bisa memproses permintaan.";
        }
    }

    if (!native) {
        onEvent({ type: "token", content: finalAnswer });
    }

    session.messages.push({ role: "user", content: question }, { role: "assistant", content: finalAnswer });
    if (!session.title) session.title = question.slice(0, 40);
    session.lastActive = Date.now();
    if (session.messages.length > MAX_MESSAGES * 2) {
        session.messages = session.messages.slice(-MAX_MESSAGES);
    }

    return finalAnswer;
}

module.exports = {
    chat,
    resetSession,
    getSessionHistory,
    listSessions
};
