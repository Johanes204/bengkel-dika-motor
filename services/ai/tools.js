const cariProduk = require("../../tools/cariProduk");
const tambahPelanggan = require("../../tools/tambahPelanggan");
const buatJanjiServis = require("../../tools/buatJanjiServis");
const exportJanjiServis = require("../../tools/exportJanjiServis");
const ubahProduk = require("../../tools/ubahProduk");

// ====== DEFINISI TOOL (untuk OpenAI-compatible tool calling) ======
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

// ====== DEFINISI TOOL ADMIN (hanya untuk mode admin) ======
const ADMIN_TOOL_DEFINITIONS = [
    {
        type: "function",
        function: {
            name: "exportJanjiServis",
            description: "Ekspor data pelanggan yang melakukan janji servis/booking servis ke file Excel. Bisa dibatasi periode: mingguan/bulanan/tahunan, misal 'minggu ini', 'minggu lalu', 'bulan ini', 'bulan juni', 'tahun 2026'. Panggil tool ini setiap kali admin meminta unduh/download/tarik/ekspor/rekap/cetak data janji servis atau booking servis ke Excel/file.",
            parameters: {
                type: "object",
                properties: {
                    periode: {
                        type: "string",
                        description: "Periode data (opsional): 'mingguan', 'bulanan', 'tahunan', atau disertai rincian seperti 'minggu lalu', 'bulan juni 2026', 'tahun 2026'. Kosongkan jika semua data."
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "ubahProduk",
            description: "Ubah/perbarui data produk di database Bengkel Dika Motor: nama produk, deskripsi/detail produk, atau harga produk. Panggil saat admin minta ubah/edit/ganti/perbarui data produk, deskripsi produk, atau harga produk. Jika admin menyebut ID produk, isi id; jika hanya nama, isi nama produk yang dicari.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "number", description: "ID produk yang ingin diubah (jika diketahui)" },
                    nama: { type: "string", description: "Nama produk yang dicari untuk diubah, contoh: 'oli matic'" },
                    name_product: { type: "string", description: "Nama produk baru (opsional)" },
                    detail_product: { type: "string", description: "Deskripsi/detail produk baru (opsional)" },
                    price_product: { type: "string", description: "Harga produk baru, angka saja tanpa Rp (opsional)" }
                },
                required: []
            }
        }
    }
];

const TOOL_HANDLERS = {
    cariProduk,
    tambahPelanggan,
    buatJanjiServis,
    exportJanjiServis,
    ubahProduk
};

async function executeTool(toolName, args) {
    const handler = TOOL_HANDLERS[toolName];
    if (!handler) return `Error: tool "${toolName}" tidak dikenal.`;
    try {
        return String(await handler(args || {}));
    } catch (err) {
        return `Error saat menjalankan ${toolName}: ${err.message}`;
    }
}

module.exports = {
    TOOL_DEFINITIONS,
    ADMIN_TOOL_DEFINITIONS,
    TOOL_HANDLERS,
    executeTool
};