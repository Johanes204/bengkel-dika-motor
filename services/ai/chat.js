const {
    MODEL,
    MAX_LOOP,
    MAX_MESSAGES,
    FORM_JANJI_SERVIS,
    keywordMotor,
    nonAutomotivePatterns
} = require("./config");
const {
    deteksiIntent,
    deteksiIntentAdmin,
    ekstrakKeywordProduk,
    ekstrakKeywordBagian,
    ekstrakParamPelanggan,
    ekstrakParamUbahProduk
} = require("./intents");
const { getSession } = require("./session");
const { cariRelevan, formatDatasetContext } = require("./rag");
const { buildSystemPrompt, buildAdminSystemPrompt } = require("./prompts");
const { TOOL_DEFINITIONS, ADMIN_TOOL_DEFINITIONS, executeTool } = require("./tools");
const { checkNativeTools, callOllama, bersihkanJawabanAkhir } = require("./ollamaClient");
const { cariInternet, formatHasilPencarian } = require("./webSearch");
const { parsePeriode } = require("../../tools/exportJanjiServis");

// ====== ORKESTRATOR UTAMA ======
// Alur lengkap satu pesan user:
// 1. Deteksi intent
// 2. Cek topik di luar otomotif
// 3. Ambil konteks RAG dari dataset kerusakan
// 4. Booking servis: form / eksekusi deterministik
// 5. Agent loop (model + tools)
// 6. Forced tool routing jika model tidak memanggil tool
// 7. Formatting pass untuk jawaban akhir
async function chat(sessionId, question, onEvent = () => {}, options = {}) {
    if (!question || !question.trim()) {
        onEvent({ type: "token", content: "Silakan ketik pertanyaan Anda." });
        return "Silakan ketik pertanyaan Anda.";
    }

    const isAdmin = options.mode === "admin";
    const session = getSession(sessionId);
    const isNewChat = session.messages.length === 0;

    // ====== KONTEKS PERCAKAPAN ======
    // Pertanyaan lanjutan seringkali tidak menyebut topik lagi
    // ("perkiraan biayanya berapa?" setelah "motor saya brebet").
    // Gabungkan 3 pertanyaan user terakhir agar intent & pencarian RAG
    // tetap relevan dengan topik awal.
    const pesanUserLalu = session.messages
        .filter(m => m.role === "user")
        .slice(-3)
        .map(m => m.content);
    const pertanyaanGabungan = [...pesanUserLalu, question].join(" ");

    let intent = isAdmin ? deteksiIntentAdmin(question) : deteksiIntent(question);

    // Follow-up biaya/kira-kira setelah percakapan → arahkan ke alur estimasi biaya
    if (!isAdmin && intent === "konsultasi" && pesanUserLalu.length > 0 &&
        /(biaya|ongkos|harga|harganya|berapa|perkira|estimasi|tarif|kena)/i.test(question) &&
        !/(produk|oli|ban|busi|aki|spare|onderdil)/i.test(question)) {
        intent = "estimasiBiaya";
    }

    // Follow-up harga setelah pencarian produk → arahkan ke cariProduk
    if (!isAdmin && intent === "konsultasi" && pesanUserLalu.length > 0 &&
        /(harga|harganya|berapa|beli)/i.test(question) &&
        ekstrakKeywordProduk(question)) {
        intent = "cariProduk";
    }

    // Tolak topik di luar otomotif (politik, hiburan, makanan, dll).
    // Pertanyaan otomotif/umum tetap diproses — model boleh menjawab dari data
    // bengkel, pengetahuan umum, maupun hasil pencarian internet.
    // (Khusus mode admin, blok ini dilewati karena admin bertanya soal pengelolaan bengkel)
    const diLuarTopik = !isAdmin && intent === "konsultasi" &&
        nonAutomotivePatterns.some(p => p.test(question)) &&
        !keywordMotor.some(kw => question.toLowerCase().includes(kw));
    if (diLuarTopik) {
        const msg = "Maaf, saya hanya bisa membantu pertanyaan seputar motor, servis, sparepart, dan perawatan kendaraan di Bengkel Dika Motor. Silakan tanya seputar motor atau bengkel kami.";
        session.messages.push({ role: "user", content: question }, { role: "assistant", content: msg });
        if (!session.title) session.title = question.slice(0, 40);
        session.lastActive = Date.now();
        onEvent({ type: "token", content: msg });
        return msg;
    }

// Gunakan pertanyaan gabungan (topik awal + pertanyaan lanjutan)
    // supaya RAG tetap menemukan data kerusakan yang relevan.
    // (Mode admin tidak butuh RAG kerusakan / pencarian internet)
    const hasilRelevan = isAdmin ? [] : cariRelevan(pertanyaanGabungan);
    const datasetContext = !isAdmin && (intent === "konsultasi" || intent === "estimasiBiaya")
        ? formatDatasetContext(hasilRelevan)
        : "";

    // ====== SUMBER INTERNET ======
    // Jika data bengkel tidak cukup relevan, cari jawaban pendukung dari internet
    // supaya AI bisa menjawab seputar permasalahan motor secara lebih lengkap.
    let webContext = "";
    if (!isAdmin && (intent === "konsultasi" || intent === "estimasiBiaya") && hasilRelevan.length < 2) {
        try {
            const hasilWeb = await cariInternet(pertanyaanGabungan.slice(0, 250), 5);
            webContext = formatHasilPencarian(hasilWeb);
        } catch {
            webContext = "";
        }
    }

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

        // ====== PATH DETERMINISTIK ======
        // Data form sudah lengkap → eksekusi langsung dengan data hasil parse,
        // jangan serahkan ke model (model sering menebak tanggal/nomor yang salah,
        // misal menulis tahun 2024 padahal user bilang "tanggal 10 Agustus").
        let result;
        try {
            result = await executeTool("buatJanjiServis", dataBooking);
        } catch (err) {
            result = "⚠️ " + (err.message || "Data tidak valid. Mohon cek kembali nama, telepon, dan tanggal Anda.");
        }
        session.messages.push({ role: "user", content: question }, { role: "assistant", content: result });
        if (!session.title) session.title = question.slice(0, 40);
        session.lastActive = Date.now();
        onEvent({ type: "token", content: result });
        return result;
    }

    // ====== PATH DETERMINISTIK ADMIN ======
    // Untuk ekspor Excel & ubah produk, eksekusi langsung TANPA model:
    // jawaban pasti ringkas ("Berikut file excelnya..."), tidak panjang lebar,
    // dan tidak bergantung keandalan model dalam merangkai kalimat.
    if (isAdmin && (intent === "exportJanjiServis" || intent === "ubahProduk")) {
        let hasilTool = null;
        let pesan = null;

        if (intent === "exportJanjiServis") {
            onEvent({ type: "tool_start", name: "exportJanjiServis" });
            try {
                // Dukung permintaan periode: "data servis per minggu/bulan/tahun",
                // "minggu lalu", "bulan juni 2026", "tahun 2026", dst.
                const periode = parsePeriode(question);
                hasilTool = await executeTool("exportJanjiServis", periode ? { periode } : {});
                onEvent({ type: "tool_done", name: "exportJanjiServis", result: hasilTool });
                pesan = `Berikut file Excel data janji servis yang Anda minta:

${hasilTool}

📥 Klik tombol **Unduh Excel** di atas untuk menyimpan filenya.`;
            } catch (err) {
                pesan = "⚠️ Gagal membuat file Excel: " + (err.message || "terjadi kesalahan.");
            }
        } else {
            const data = ekstrakParamUbahProduk(question);
            const punyaTarget = !!(data.id || data.nama);
            const punyaPerubahan = !!(data.name_product || data.detail_product || data.price_product);
            // Panggil tool bila admin menyebut target (id/nama) ATAU nilai perubahan.
            // Tool sendiri yang menindaklanjuti bila salah satunya belum lengkap
            // (misal: minta produk mana yang diubah, atau perubahan apa yang dilakukan).
            if (punyaTarget || punyaPerubahan) {
                onEvent({ type: "tool_start", name: "ubahProduk" });
                try {
                    hasilTool = await executeTool("ubahProduk", data);
                    onEvent({ type: "tool_done", name: "ubahProduk", result: hasilTool });
                    pesan = "Berikut hasilnya:\n\n" + hasilTool;
                } catch (err) {
                    pesan = "⚠️ Gagal mengubah produk: " + (err.message || "terjadi kesalahan.");
                }
            }
            // Parameter belum lengkap → lanjut ke agent loop (model) di bawah
        }

        if (pesan) {
            session.messages.push({ role: "user", content: question }, { role: "assistant", content: pesan });
            if (!session.title) session.title = question.slice(0, 40);
            session.lastActive = Date.now();
            onEvent({ type: "token", content: pesan });
            return pesan;
        }
    }

    // Riwayat ringkas: HANYA pertanyaan user (dipotong), bukan jawaban AI panjang,
// supaya model tidak mengulang jawaban sebelumnya (terutama di pertanyaan biaya).
    const riwayat = session.messages
        .filter(m => m.role === "user")
        .slice(-5)
        .map(m => `User: ${m.content.slice(0, 200)}`)
        .join("\n");

    const sysPrompt = isAdmin
        ? buildAdminSystemPrompt({ isNewChat, riwayat })
        : buildSystemPrompt({ intent, datasetContext, webContext, isNewChat, riwayat });

    const messages = [
        { role: "system", content: sysPrompt },
        // Untuk pertanyaan biaya: JANGAN kirim riwayat percakapan penuh agar model
        // tidak mengulang penjelasan sebelumnya. Konteks topik (gejala yang dibahas
        // user di awal) sudah ada dalam "riwayat" di system prompt.
        ...(intent === "estimasiBiaya" || intent === "cariProduk" ? [] : session.messages.slice(-MAX_MESSAGES)),
        { role: "user", content: question }
    ];

    const native = await checkNativeTools();

    let finalAnswer = "";
    let toolResults = [];
    let pendingTool = null;

    // ====== FORMATTING PASS ======
    // Setelah tool dieksekusi, minta model merangkum hasil tool menjadi jawaban
    // yang natural, rapi, dan tanpa istilah internal.
    const namaToolInternal = isAdmin
        ? "cariProduk, buatJanjiServis, tambahPelanggan, exportJanjiServis, ubahProduk"
        : "cariProduk, buatJanjiServis, tambahPelanggan";

    const runFormattingPass = async (results) => {
        const fmt = results.map(r => `— Tool ${r.name}: ${r.result}`).join("\n\n");
        const isBiaya = intent === "estimasiBiaya";
        const instrBiaya = `
untuk perkiraan biaya servis/perbaikan. MULAI langsung dengan kalimat perkiraan biaya (misal: "Perkiraan biaya servis untuk masalah ... sekitar Rp... sampai Rp..."). Jika hasil tool berisi harga sparepart, gunakan harga part tersebut ditambah estimasi jasa (Rp50.000-100.000) sebagai dasar hitung, dan tampilkan sebagai *perkiraan*, bukan kepastian. Jika harga part tidak tersedia atau tidak relevan, pakai pengetahuan umum tarif servis motor dan harga pasar umum untuk rentang estimasi, tetap bertanda *perkiraan*. JANGAN menyarankan sparepart yang tidak relevan dengan kerusakan yang dibahas (misal shock, lampu, bodi padahal yang dibahas mesin/CVT) — abaikan produk tak relevan dari hasil tool. Dilarang menyebut nama tool apapun (cariProduk, buatJanjiServis, tambahPelanggan). Kalimat penawaran "silakan datang/pesan janji servis" HANYA boleh ditulis SEKALI di paling akhir jawaban sebagai kalimat penutup.`;
        const formatMessages = [
            { role: "system", content: sysPrompt },
            { role: "user", content: question },
            { role: "assistant", content: "Saya akan mencari informasi tersebut." },
            { role: "user", content: `Hasil tool:\n${fmt}\n\nBuatkan jawaban yang natural dan informatif kepada user berdasarkan hasil tool di atas${instrBiaya}.

ATURAN WAJIB:
1. JANGAN menambahkan informasi, produk, harga, atau pernyataan yang TIDAK ada di hasil tool.
2. Jangan menyebut kata "tool", "database", "dataset", atau nama tool internal (${namaToolInternal}).
3. JANGAN mengulang jawaban sebelumnya dan JANGAN mengulang pertanyaan user yang sudah dijawab — langsung jawab lanjutannya.
4. Untuk booking servis / pendaftaran pelanggan: cukup konfirmasi bahwa data sudah tercatat beserta detailnya.
5. Untuk pencarian produk: tampilkan nama, harga, dan detail produk.
6. Susun jawaban rapi: gunakan penomoran "1." "2." "3." untuk urutan, tanda "-" untuk daftar poin, dan paragraf pendek.
7. Gunakan **bold** untuk kata atau frasa penting yang ditegaskan, dan *miring* untuk kata berbahasa asing.` }
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

    // ====== AGENT LOOP ======
    // Untuk estimasiBiaya TIDAK dijalankan di sini: jawaban perkiraan biaya dibuat
    // lewat jalur tunggal di FORCED TOOL ROUTING agar cuma SATU aliran jawaban
    // (tidak ada teks lanjutan/duplikat beberapa detik kemudian).
    const toolDefinitions = isAdmin ? ADMIN_TOOL_DEFINITIONS : TOOL_DEFINITIONS;

    for (let i = 0; intent !== "estimasiBiaya" && i < MAX_LOOP; i++) {
        const body = {
            model: MODEL,
            messages,
            options: { temperature: 0.2, num_ctx: 4096 }
        };

        if (native) {
            // estimasiBiaya: TIDAK pakai tool sama sekali — langsung jawab perkiraan
            // biaya supaya tidak ada JSON tool call / badge tool yang muncul.
            if (intent !== "konsultasi" && intent !== "estimasiBiaya") {
                body.tools = toolDefinitions;
            }
            body.stream = true;
            if (i === 0 && !isAdmin && intent === "cariProduk") {
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

        // ----- TOOL KHUSUS ADMIN -----
        if (isAdmin && pendingTool === "exportJanjiServis") {
            const result = await executeTool("exportJanjiServis", {});
            toolResults.push({ name: "exportJanjiServis", result });
        } else if (isAdmin && pendingTool === "ubahProduk") {
            const data = ekstrakParamUbahProduk(question);
            const punyaTarget = !!(data.id || data.nama);
            const punyaPerubahan = !!(data.name_product || data.detail_product || data.price_product);
            if (punyaTarget || punyaPerubahan) {
                const result = await executeTool("ubahProduk", data);
                toolResults.push({ name: "ubahProduk", result });
            } else {
                finalAnswer = "Saya bantu perbarui data produknya. Sebutkan produk mana (nama atau ID) yang ingin diubah beserta perubahannya, contoh: \"ubah deskripsi produk oli matic menjadi oli sintetis 0.8L\" atau \"ubah harga produk dengan id 3 menjadi 50000\".";
            }
        }

        if (pendingTool === "estimasiBiaya") {
            // Gabungkan pertanyaan sebelumnya + pertanyaan sekarang untuk konteks
            const konteksQ = [...session.messages.filter(m => m.role === "user").slice(-3).map(m => m.content), question].join(" ");
            const hasilRelevanBiaya = cariRelevan(konteksQ, 5);
            // Filter: hanya item yang cocok dengan gejala yang disebut user
            // (misal "brebet") supaya estimasi tidak melenceng ke gejala lain (aki/dll).
            const kataGejala = (konteksQ.toLowerCase().match(/brebet|tersendat|susah hidup|mati|ngetuk|berisik|boros|asap|getar|bunyi|macet|ngebul|stater/g) || []);
            const relevanGejala = kataGejala.length
                ? hasilRelevanBiaya.filter(h => kataGejala.some(k => (`${h.gejala} ${h.solusi}`).toLowerCase().includes(k)))
                : [];
            const pakaiRelevan = relevanGejala.length ? relevanGejala : hasilRelevanBiaya;
            const bagianTeks = pakaiRelevan.length
                ? pakaiRelevan.map(h => `"${h.gejala}" → ${h.solusi}`).join("; ")
                : "";
            const konteksBiaya = bagianTeks
                ? `Informasi relevan dari data bengkel:\n${bagianTeks}`
                : "Tidak ada informasi khusus dari data bengkel.";

                const estimasiMessages = [
{ role: "system", content: buildSystemPrompt({ intent, datasetContext: "", webContext, isNewChat, riwayat }) },
                    { role: "user", content: question },
                    { role: "user", content: `${konteksBiaya}\n\nBuatkan perkiraan biaya servis/perbaikan motor dalam Bahasa Indonesia. Berikan rentang harga umum (misal "Rp50.000\u2013100.000") sebagai *perkiraan*, sebutkan komponen yang biasa diganti jika ada, sebutkan juga kisarannya jasa bengkel umum, lalu ingatkan bahwa harga pasti bisa berbeda dan sarankan pembawanya ke Bengkel Dika Motor untuk pengecekan akurat. JANGAN mengulangi daftar gejala/langkah yang sudah dijelaskan pada jawaban sebelumnya — langsung bahas biaya dan komponen terkaitnya saja. HANYA bahas komponen yang berhubungan dengan gejala/pertanyaan user; JANGAN membahas gejala atau komponen lain yang tidak disebut user (misal aki, lampu, kabel) kecuali memang relevan. JANGAN menyebut nama tool/internal seperti "buatJanjiServis" — gunakan kalimat natural misal "kami bisa buatkan janji servis".` }
                ];
                try {
                    const est = await callOllama({
                        model: MODEL,
                        messages: estimasiMessages,
                        stream: native,
                        options: { temperature: 0.4, num_ctx: 4096 }
                    }, { native, onEvent });
                    finalAnswer = est.content.trim();
                } catch {
                    finalAnswer = "Perkiraan biaya servis biasanya tergantung kerusakannya. Sebaiknya dibawa ke **Bengkel Dika Motor** untuk pemeriksaan langsung supaya biaya pastinya bisa dihitung dengan tepat.";
                }
            } else if (pendingTool === "cariProduk") {
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
        // Admin: langsung pakai hasil tool sebagai jawaban (ringkas, tanpa
        // model merangkai ulang jadi kalimat panjang).
        finalAnswer = isAdmin
            ? "Berikut hasilnya:\n\n" + toolResults.map(r => r.result).join("\n\n")
            : await runFormattingPass(toolResults);
    }

    if (!finalAnswer || finalAnswer === "" || finalAnswer === "Maaf, tidak bisa memproses permintaan.") {
        if (intent === "buatJanjiServis") {
            finalAnswer = FORM_JANJI_SERVIS;
        } else if (intent === "tambahPelanggan") {
            finalAnswer = "Tentu, saya bantu daftarkan sebagai pelanggan. Mohon lengkapi: nama dan nomor telepon Anda. Contoh: daftarkan saya nama Budi, telepon 081234567890.";
        } else if (isAdmin && intent === "exportJanjiServis") {
            finalAnswer = "Saya bisa buatkan file Excel berisi data janji servis. Cukup tulis: \"ekspor data janji servis ke Excel\".";
        } else if (isAdmin && intent === "ubahProduk") {
            finalAnswer = "Saya bisa bantu ubah data produk (nama, deskripsi, atau harga). Sebutkan produknya (nama atau ID) beserta perubahannya, contoh: \"ubah deskripsi produk oli matic dengan id 3 menjadi oli sintetis 0.8L\" atau \"ubah harga produk id 3 menjadi Rp 50000\".";
        } else {
            finalAnswer = "Maaf, tidak bisa memproses permintaan.";
        }
    }

    finalAnswer = bersihkanJawabanAkhir(finalAnswer);

    // Admin: hasil tool selalu ditampilkan sebagai pesan akhir walau model
    // streaming (native), supaya jawaban "berikut file excelnya" pasti muncul.
    if (!native || isAdmin) {
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

module.exports = { chat };