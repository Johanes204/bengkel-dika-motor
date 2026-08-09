const { SESSION_TTL_MS, MAX_SESSIONS, MAX_MESSAGES } = require("./config");

// ====== SESSION MEMORY ======
// Menyimpan riwayat percakapan per sesi (in-memory).
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

module.exports = {
    getSession,
    resetSession,
    getSessionHistory,
    listSessions
};