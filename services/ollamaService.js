// ====== ENTRY POINT AI AGENT ======
// Modul ini hanya re-export dari services/ai/ agar API lama tetap kompatibel
// (server.js memanggil require('./services/ollamaService')).
//
// Struktur modul AI:
//   services/ai/config.js       — konstanta, dataset, daftar keyword
//   services/ai/intents.js      — deteksi intent + parsing data pelanggan/tanggal
//   services/ai/session.js      — memori percakapan per sesi
//   services/ai/rag.js          — pencarian data kerusakan (RAG)
//   services/ai/prompts.js      — penyusun system prompt
//   services/ai/tools.js        — definisi & eksekutor tool
//   services/ai/ollamaClient.js — komunikasi API Ollama
//   services/ai/chat.js         — orkestrator alur percakapan (inti)
const { chat } = require("./ai/chat");
const { resetSession, getSessionHistory, listSessions } = require("./ai/session");

module.exports = {
    chat,
    resetSession,
    getSessionHistory,
    listSessions
};