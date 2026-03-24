const fs = require('node:fs/promises');

const {
    R34_INFO_DIRECTORY,
    DS_INFO_DIRECTORY,
    PT_INFO_DIRECTORY,
    R34_SEARCHES_LOG_FILE,
    DS_DOWNLOADS_LOG_FILE,
    PT_DOWNLOADS_LOG_FILE,
    PT_DOWNLOADS_LOG_CSV_FILE
} = require('../constants/bot');
const { formatR34InfoReply } = require('../services/r34/info');

function toCsvField(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
}

async function appendR34SearchLog(chatId, character, result, mediaType) {
    await fs.mkdir(R34_INFO_DIRECTORY, { recursive: true });

    const logEntry =
        `Fecha: ${new Date().toLocaleString('es-ES')}\n` +
        `Chat: ${chatId}\n` +
        `${formatR34InfoReply(character, result, mediaType)}\n` +
        '----------------------------------------\n';

    await fs.appendFile(R34_SEARCHES_LOG_FILE, logEntry, 'utf8');
}

async function appendDsDownloadLog(chatId, sourceUrl, title, filePath) {
    await fs.mkdir(DS_INFO_DIRECTORY, { recursive: true });

    const logEntry =
        `Fecha: ${new Date().toLocaleString('es-ES')}\n` +
        `Chat: ${chatId}\n` +
        `URL: ${sourceUrl}\n` +
        `Titulo: ${title || 'N/A'}\n` +
        `Archivo: ${filePath || 'N/A'}\n` +
        '----------------------------------------\n';

    await fs.appendFile(DS_DOWNLOADS_LOG_FILE, logEntry, 'utf8');
}

async function appendPtDownloadLog(chatId, sourceUrl, title, filePath, mediaType = 'N/A') {
    await fs.mkdir(PT_INFO_DIRECTORY, { recursive: true });

    const now = new Date();
    const formattedDate = now.toLocaleString('es-ES');

    const logEntry =
        `Fecha: ${formattedDate}\n` +
        `Chat: ${chatId}\n` +
        `Tipo: ${mediaType}\n` +
        `URL: ${sourceUrl}\n` +
        `Titulo: ${title || 'N/A'}\n` +
        `Archivo: ${filePath || 'N/A'}\n` +
        '----------------------------------------\n';

    await fs.appendFile(PT_DOWNLOADS_LOG_FILE, logEntry, 'utf8');

    const csvLine = [
        formattedDate,
        chatId,
        mediaType,
        sourceUrl || 'N/A',
        title || 'N/A',
        filePath || 'N/A'
    ].map(toCsvField).join(',') + '\n';

    await fs.appendFile(PT_DOWNLOADS_LOG_CSV_FILE, csvLine, 'utf8');
}

module.exports = {
    appendR34SearchLog,
    appendDsDownloadLog,
    appendPtDownloadLog
};
