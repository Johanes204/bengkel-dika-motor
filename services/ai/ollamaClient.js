const axios = require("axios");
const { OLLAMA_URL, MODEL } = require("./config");
const { TOOL_DEFINITIONS } = require("./tools");

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

// ====== PARSING TOOL CALL (fallback non-native) ======
const NAMA_TOOL_SAH = new Set(["cariProduk", "tambahPelanggan", "buatJanjiServis", "exportJanjiServis", "ubahProduk"]);

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
                    const parsed = JSON.parse(text.slice(jsonStart, i + 1));
                    if (!parsed || typeof parsed !== "object") return null;
                    // Format "TOOL_CALL:{...}" / prompt-based lama: pakai key "tool"+"params"
                    if (parsed.tool) {
                        if (!NAMA_TOOL_SAH.has(parsed.tool)) return null;
                        return parsed;
                    }
                    // Format model modern: {"name":"cariProduk","parameters":{...}} / {"arguments":{...}}
                    const toolName = parsed.name || parsed.function?.name;
                    if (!toolName || !NAMA_TOOL_SAH.has(toolName)) return null;
                    const params = parsed.parameters || parsed.arguments || parsed.params || {};
                    return { tool: toolName, params: typeof params === "object" && params !== null ? params : {} };
                } catch {
                    return null;
                }
            }
        }
    }
    return null;
}

// Model tanpa native tools kadang menulis tool call sebagai teks biasa seperti
// "cariProduk(oli)" atau "```tool\ncariProduk(oli)\n```". Deteksi & ubah jadi
// objek tool call agar tetap bisa dieksekusi, bukan tampil mentah di jawaban.
function parseTextToolCall(text) {
    if (!text) return null;
    const t = text.trim().replace(/^```(?:tool)?\s*/i, "").replace(/```\s*$/, "").trim();
    const m = t.match(/(cariProduk|tambahPelanggan|buatJanjiServis)\s*\(\s*([^)]*?)\s*\)/i);
    if (!m) return null;
    const name = m[1];
    if (name !== "cariProduk") return null;
    return { tool: name, params: { keyword: m[2].trim() } };
}

// Hapus baris tool call teks yang tersisa agar tidak tampil mentah di jawaban
function stripTextToolCalls(text) {
    if (!text) return "";
    return text
        .replace(/```(?:json|tool)?\s*\n[\s\S]*?```/gi, "")
        .replace(/^\s*TOOL_CALL:\s*\{[\s\S]*?\}\s*$/gim, "")
        .replace(/^\s*(?:cariProduk|tambahPelanggan|buatJanjiServis|estimasiBiaya)\s*\([^)]*\)\s*$/gim, "")
        .trim();
}

// ====== PEMBERSIH JSON TOOL CALL ======
// Model kadang menulis tool call sebagai objek JSON murni, misalnya:
//   {"name":"estimasi biaya servis","parameters":{...}}
// atau gabungan seperti "tidak apa-apa\n{"name":"cariProduk","parameters":{"keyword":"oli"}}"
// Blok seperti ini harus DIBUANG — bukan dieksekusi — agar tidak bocor ke jawaban user.
function bersihkanJsonToolCall(text) {
    if (!text) return text;
    let bersih = text;
    const RE = /\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"parameters"(?:\s*:\s*\{[^}]*\}|\s*:\s*"[\s\S]*?")[\s\S]*?\}/i;
    let m;
    while ((m = RE.exec(bersih)) !== null) {
        bersih = bersih.slice(0, m.index) + bersih.slice(m.index + m[0].length);
    }
    return bersih.trim();
}

// ====== SANITASI JAWABAN AKHIR ======
// Bersihkan jawaban dari residu tool call (teks, JSON, maupun blok kode),
// hapus kalimat maaf-penolakan palsu yang suka diucapkan model di awal,
// dan rapikan spasi agar jawaban yang tampil ke user selalu bersih.
function bersihkanJawabanAkhir(text) {
    if (!text) return "";
    return bersihkanJsonToolCall(stripTextToolCalls(text))
        .replace(/^\s*(?:Mohon maaf|Maaf|Mohon)[,.]*\s*saya tidak bisa membantu[^.\n]*\.\s*/i, "")
        .replace(/^\s*(?:Namun|Tapi),?\s*saya (?:hanya )?dapat memberikan beberapa saran umum[^.\n]*\.\s*/i, "")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]+\n/g, "\n")
        .trim();
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

// ====== PANGGIL OLLAMA ======
async function callOllama(body, { native, onEvent }) {
    if (!native) {
        try {
            const res = await axios.post(`${OLLAMA_URL}/api/chat`, body, { timeout: 120000 });
            let content = res.data.message?.content || "";
            const toolCall = parseToolCall(content) || parseTextToolCall(content);
            const toolCalls = toolCall && toolCall.tool
                ? [{ function: { name: toolCall.tool, arguments: toolCall.params || {} } }]
                : [];
            if (toolCalls.length > 0) content = stripTextToolCalls(content);
            content = bersihkanJsonToolCall(content);
            return { content, toolCalls };
        } catch (err) {
            const detail = err.response?.data?.error || err.message || "";
            if (/connect|ECONNREFUSED/i.test(detail)) {
                throw new Error("Ollama belum berjalan. Silakan jalankan Ollama terlebih dahulu.");
            }
            throw new Error("Gagal memanggil Ollama: " + String(detail).substring(0, 200));
        }
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
        content = bersihkanJsonToolCall(content);
    } catch (err) {
        const detail = err.response?.data?.error || err.message || "";
        if (/connect|ECONNREFUSED/i.test(detail)) {
            throw new Error("Ollama belum berjalan. Silakan jalankan Ollama terlebih dahulu.");
        }
        throw new Error("Gagal terhubung ke Ollama: " + detail.substring(0, 120));
    }

    return { content, toolCalls };
}

module.exports = {
    checkNativeTools,
    callOllama,
    bersihkanJawabanAkhir
};