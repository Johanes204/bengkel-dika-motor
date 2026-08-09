const { dataset, stopWords } = require("./config");

// ====== TOKENISASI ======
function tokenize(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w));
}

// ====== RAG (data kerusakan) ======
// Cari entri dataset kerusakan motor yang paling relevan dengan pertanyaan.
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

// Format hasil RAG menjadi teks konteks untuk prompt model.
function formatDatasetContext(hasil) {
    if (hasil.length === 0) return "";
    let context = "\nData kerusakan relevan dari database bengkel:\n";
    hasil.forEach((item, i) => {
        context += `\n${i + 1}. Gejala: "${item.gejala}"\n   Penyebab: ${item.penyebab}\n   Solusi: ${item.solusi}`;
    });
    return context;
}

module.exports = {
    tokenize,
    cariRelevan,
    formatDatasetContext
};