const cariProduk = require("../../tools/cariProduk");
const tambahPelanggan = require("../../tools/tambahPelanggan");
const buatJanjiServis = require("../../tools/buatJanjiServis");

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

const TOOL_HANDLERS = {
    cariProduk,
    tambahPelanggan,
    buatJanjiServis
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
    TOOL_HANDLERS,
    executeTool
};