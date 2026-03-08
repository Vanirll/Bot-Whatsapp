const { extractFirstUrl, isSupportedUrl } = require('../utils/url');
const { isTruthy } = require('../utils/env');
const { getReadableError } = require('../utils/errors');
const { downloadVideo, safeCleanup } = require('../services/downloader');
const { appendDsDownloadLog } = require('../repositories/logRepository');
const { acquireDownloadSlot, getActiveDownloads } = require('../services/download/queue');
const { sendMediaWithFallback } = require('../services/download/sendMedia');

async function handleDownloadCommand({ client, message, lowerText, text, options }) {
    const isDownloadCommand = lowerText.startsWith('.ds') || lowerText.startsWith('#ds');
    if (!isDownloadCommand) {
        return false;
    }

    const url = extractFirstUrl(text);
    if (!url) {
        await message.reply('⚠️ Debes enviar el enlace junto al comando. Ejemplo: *.ds https://...*');
        return true;
    }

    if (!isSupportedUrl(url)) {
        await message.reply('⚠️ Enlace no compatible. Soportado: TikTok, Instagram, YouTube, Facebook, Twitter/X y Reddit.');
        return true;
    }

    let downloadedFile = null;
    const releaseSlot = await acquireDownloadSlot();

    try {
        if (getActiveDownloads() > 1) {
            await message.reply(`🕒 Hay cola de descargas. Tu turno esta en espera (activos: ${getActiveDownloads()}).`);
        } else {
            await message.reply('⏬ Descargando video, espera un momento...');
        }

        const { filePath, title } = await downloadVideo(url);
        downloadedFile = filePath;

        try {
            await appendDsDownloadLog(message.from, url, title, filePath);
        } catch (logError) {
            console.warn('No se pudo registrar descarga .ds en TXT:', logError?.message || logError);
        }

        await sendMediaWithFallback(client, message.from, filePath, title, isTruthy(process.env.ALLOW_DOCUMENT_FALLBACK));
    } catch (error) {
        console.error('Error descargando:', error);
        const reason = getReadableError(error);
        await message.reply(`❌ Error: ${reason}`);
    } finally {
        if (!options.keepDownloadedFiles) {
            await safeCleanup(downloadedFile);
        }

        releaseSlot();
    }

    return true;
}

module.exports = {
    handleDownloadCommand
};
