const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const db = require("../config/db");
const { BULAN_ID } = require("../services/ai/config");

const EXPORT_DIR = path.join(__dirname, "..", "data", "exports");
const FILE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const STATUS_LABEL = {
    terjadwal: "Terjadwal",
    diproses: "Diproses",
    selesai: "Selesai",
    batal: "Batal"
};

const BULAN_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

// ====== PARSING PERIODE ======
// Mengenali permintaan periode dari teks admin, misal:
// "per minggu / mingguan / minggu ini / minggu lalu",
// "per bulan / bulanan / bulan ini / bulan lalu / bulan juni 2026",
// "per tahun / tahunan / tahun ini / tahun lalu / tahun 2026".
// Keluaran: { mode: 'mingguan'|'bulanan'|'tahunan', label, from, to } (tanggal ISO).
function parsePeriode(text) {
    const q = String(text || "").toLowerCase();
    if (!q) return null;

    const now = new Date();
    const ymd = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const fmt = (d) => ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const tambahHari = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const awalMinggu = (d) => { const x = new Date(d); const hari = (x.getDay() + 6) % 7; x.setDate(x.getDate() - hari); return x; };

    const labelRentang = (da, db) => {
        const a = da.getDate(), b = db.getDate();
        const mA = BULAN_SHORT[da.getMonth()], mB = BULAN_SHORT[db.getMonth()];
        const yA = da.getFullYear(), yB = db.getFullYear();
        if (mA === mB && yA === yB) return `${a}-${b} ${mA} ${yA}`;
        if (yA === yB) return `${a} ${mA} - ${b} ${mB} ${yA}`;
        return `${a} ${mA} ${yA} - ${b} ${mB} ${yB}`;
    };

    // ===== TAHUNAN =====
    // "tahun 2026", "tahun lalu", "tahun ini", "per tahun / tahunan"
    let m = q.match(/tahun\s*(\d{4})\b/);
    if (m) {
        const y = Number(m[1]);
        return { mode: "tahunan", label: `Tahun ${y}`, from: ymd(y, 1, 1), to: ymd(y, 12, 31) };
    }
    if (/\btahun\s*(lalu|kemarin)\b/.test(q)) {
        const y = now.getFullYear() - 1;
        return { mode: "tahunan", label: `Tahun Lalu (${y})`, from: ymd(y, 1, 1), to: ymd(y, 12, 31) };
    }
    if (/(pertahun|tahunan|year(?:ly)?)\b/.test(q) || /\btahun\s*(ini|sekarang)\b/.test(q)) {
        const y = now.getFullYear();
        return { mode: "tahunan", label: `Tahun Ini (${y})`, from: ymd(y, 1, 1), to: ymd(y, 12, 31) };
    }
    if (/\btahun\b/.test(q)) {
        const y = now.getFullYear();
        return { mode: "tahunan", label: `Tahun ${y}`, from: ymd(y, 1, 1), to: ymd(y, 12, 31) };
    }

    // ===== BULANAN =====
    const tahunDalamQ = q.match(/\b(20\d{2})\b/);
    const tahunQ = tahunDalamQ ? Number(tahunDalamQ[1]) : now.getFullYear();
    const mBulan = (mo, y, label) => {
        const last = new Date(y, mo, 0).getDate();
        return { mode: "bulanan", label, from: ymd(y, mo, 1), to: ymd(y, mo, last) };
    };

    // "bulan 6" / "bulan 06-2026" / "bulan ke-6 tahun 2026"
    m = q.match(/bulan\s+(?:ke\s*)?-?\s*(\d{1,2})\b\s*(?:[\/\-]\s*(20\d{2}))?\s*(20\d{2})?/);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) {
        const mo = Number(m[1]);
        const y = m[2] ? Number(m[2]) : (m[3] ? Number(m[3]) : tahunQ);
        return mBulan(mo, y, `${NAMA_BULAN[mo - 1]} ${y}`);
    }

    // "bulan juni 2026", "juni 2026", "bulan juni"
    const daftarBulan = Object.keys(BULAN_ID).sort((a, b) => b.length - a.length);
    for (const nama of daftarBulan) {
        if (new RegExp(`${nama}\\b`).test(q)) {
            const mY = q.match(new RegExp(`${nama}\\b\\s*(?:tahun\\s*)?(20\\d{2})`));
            const mo = Number(BULAN_ID[nama]);
            const y = mY ? Number(mY[1]) : tahunQ;
            const labelBulan = nama[0].toUpperCase() + nama.slice(1);
            return mBulan(mo, y, `${labelBulan} ${y}`);
        }
    }

    if (/\bbulan\s*(lalu|kemarin)\b/.test(q)) {
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return mBulan(prev.getMonth() + 1, prev.getFullYear(), "Bulan Lalu");
    }
    if (/\bbulan\s*(ini|sekarang)\b/.test(q) || /(perbulan|bulanan|month(?:ly)?)\b/.test(q)) {
        return mBulan(now.getMonth() + 1, now.getFullYear(), "Bulan Ini");
    }
    if (/\bbulan\b/.test(q)) {
        return mBulan(now.getMonth() + 1, now.getFullYear(), "Bulan Ini");
    }

    // ===== MINGGUAN =====
    if (/\bminggu\s*(lalu|kemarin)\b/.test(q)) {
        const start = tambahHari(awalMinggu(now), -7);
        const end = tambahHari(start, 6);
        return { mode: "mingguan", label: `Minggu Lalu (${labelRentang(start, end)})`, from: fmt(start), to: fmt(end) };
    }
    if (/\bminggu\s*(ini|sekarang)\b/.test(q) || /(perminggu|mingguan|week(?:ly)?)\b/.test(q)) {
        const start = awalMinggu(now);
        const end = tambahHari(start, 6);
        return { mode: "mingguan", label: `Minggu Ini (${labelRentang(start, end)})`, from: fmt(start), to: fmt(end) };
    }
    if (/\bminggu\b/.test(q)) {
        const start = awalMinggu(now);
        const end = tambahHari(start, 6);
        return { mode: "mingguan", label: `Minggu Ini (${labelRentang(start, end)})`, from: fmt(start), to: fmt(end) };
    }

    return null;
}

function queryAppointments() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT id, nama, telepon, tanggal, keluhan, status, created_at
                     FROM service_appointments
                     ORDER BY tanggal ASC, id ASC`;
        db.query(sql, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
}

function filterByPeriode(rows, periode) {
    if (!periode || !periode.from || !periode.to) return rows;
    return rows.filter((r) => {
        const t = String(r.tanggal || "").slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
        return t >= periode.from && t <= periode.to;
    });
}

// Ringkasan jumlah data per kelompok waktu (minggu/bulan/tahun)
function buildRingkasan(rows, periode) {
    const arr = [];
    for (const r of rows) {
        const t = String(r.tanggal || "").slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) continue;
        const [y, mo, d] = t.split("-").map(Number);
        const dt = new Date(y, mo - 1, d);
        let key, label;
        if (periode.mode === "tahunan") {
            key = `${y}-${mo}`;
            label = `${BULAN_SHORT[mo - 1]} ${y}`;
        } else if (periode.mode === "bulanan") {
            const dayIdx = (dt.getDay() + 6) % 7;
            const start = new Date(y, mo - 1, d - dayIdx);
            const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
            key = `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`;
            label = `Minggu ${start.getDate()}-${end.getDate()} ${BULAN_SHORT[start.getMonth()]}`;
        } else {
            key = t;
            label = `${HARI_ID[dt.getDay()]}, ${d} ${BULAN_SHORT[mo - 1]} ${y}`;
        }
        const found = arr.find((x) => x.key === key);
        if (found) found.n++;
        else arr.push({ key, label, n: 1 });
    }
    arr.sort((a, b) => (a.key < b.key ? -1 : 1));
    const out = arr.map((x) => ({ Periode: x.label, Jumlah: x.n }));
    out.push({ Periode: "Total", Jumlah: rows.length });
    return out;
}

function makeExcelBuffer(rows, periode) {
    const data = rows.map((r) => ({
        ID: r.id,
        Nama: r.nama,
        Telepon: r.telepon,
        "Tanggal Servis": r.tanggal,
        Keluhan: r.keluhan || "-",
        Status: STATUS_LABEL[r.status] || r.status,
        "Dibuat Pada": r.created_at ? String(r.created_at).slice(0, 19).replace("T", " ") : "-"
    }));

    const wb = XLSX.utils.book_new();

    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
        { wch: 6 },
        { wch: 24 },
        { wch: 16 },
        { wch: 15 },
        { wch: 45 },
        { wch: 13 },
        { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Janji Servis");

    if (periode) {
        const ringkasan = buildRingkasan(rows, periode);
        const ws2 = XLSX.utils.json_to_sheet(ringkasan);
        ws2["!cols"] = [{ wch: 24 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, ws2, "Ringkasan");
    }

    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function pruneOldFiles() {
    try {
        if (!fs.existsSync(EXPORT_DIR)) return;
        const files = fs.readdirSync(EXPORT_DIR);
        const now = Date.now();
        files.forEach((f) => {
            const full = path.join(EXPORT_DIR, f);
            try {
                if (now - fs.statSync(full).mtimeMs > FILE_MAX_AGE_MS) fs.unlinkSync(full);
            } catch { /* abaikan */ }
        });
    } catch { /* abaikan */ }
}

function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function exportJanjiServis(params = {}) {
    let periode = params && params.periode;
    if (typeof periode === "string") periode = parsePeriode(periode);
    if (periode && !(periode.mode && periode.label && periode.from && periode.to)) periode = null;

    const allRows = await queryAppointments();
    if (allRows.length === 0) {
        return "Belum ada data janji servis untuk diekspor. Saat ada pelanggan yang booking, datanya akan otomatis tersedia di sini.";
    }

    const rows = filterByPeriode(allRows, periode);
    if (periode && rows.length === 0) {
        return `Tidak ada data janji servis pada periode ${periode.label}.`;
    }

    pruneOldFiles();
    fs.mkdirSync(EXPORT_DIR, { recursive: true });

    const tanggal = new Date().toISOString().slice(0, 10);
    const segmen = periode ? slugify(`${periode.mode}-${periode.label}`) : "semua";
    const filename = `janji-servis-${segmen}-${tanggal}-${Date.now()}.xlsx`;
    fs.writeFileSync(path.join(EXPORT_DIR, filename), makeExcelBuffer(rows, periode));

    const url = `/admin/exports/${filename}`;
    const keterangan = periode ? `periode ${periode.label}` : "seluruh waktu";
    return `Data janji servis ${keterangan} berhasil dibuat (${rows.length} data).\n📥 File: ${url}`;
}

module.exports = exportJanjiServis;
module.exports.parsePeriode = parsePeriode;