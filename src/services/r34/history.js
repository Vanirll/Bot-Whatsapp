const { R34_HISTORY_LIMIT, R34_MAX_REPEAT_PER_POST } = require('../../constants/bot');

const lastR34ByChat = new Map();
const r34HistoryByChat = new Map();

function getLastR34Result(chatId) {
    return lastR34ByChat.get(chatId) || null;
}

function setLastR34Result(chatId, payload) {
    lastR34ByChat.set(chatId, payload);
}

function getR34PostUsageCount(chatId, postId) {
    if (!postId) {
        return 0;
    }

    const history = r34HistoryByChat.get(chatId);
    if (!Array.isArray(history) || history.length === 0) {
        return 0;
    }

    return history.reduce((count, item) => (item === postId ? count + 1 : count), 0);
}

function isR34RepeatLimitReached(chatId, postId, maxRepeat = R34_MAX_REPEAT_PER_POST) {
    return getR34PostUsageCount(chatId, postId) >= maxRepeat;
}

function registerR34PostInHistory(chatId, postId, historyLimit = R34_HISTORY_LIMIT) {
    if (!postId) {
        return;
    }

    const history = r34HistoryByChat.get(chatId) || [];
    history.push(postId);

    if (history.length > historyLimit) {
        history.splice(0, history.length - historyLimit);
    }

    r34HistoryByChat.set(chatId, history);
}

module.exports = {
    getLastR34Result,
    setLastR34Result,
    isR34RepeatLimitReached,
    registerR34PostInHistory
};
