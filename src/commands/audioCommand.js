const { extractFirstUrl, isSupportedUrl } = require('../utils/url');
const { getReadableError } = require('../utils/errors');
const { downloadAudio, safeCleanup } = require('../services/downloader');
const { appendDsDownloadLog } = require('../repositories/logRepository');
const { acquireDownloadSlot, getActiveDownloads } = require('../services/download/queue');
const { sendAudioInline, sendAudioAsDocument } = require('../services/download/sendAudio');

async function handleAudioCommand({ client, message, lowerText, text, options }) {
    const isAudioCommand =
        lowerText.startsWith('.mp3') ||
        lowerText.startsWith('#mp3') ||
        lowerText.startsWith('.mp3d') ||
        lowerText.startsWith('#mp3d');
    if (!isAudioCommand) {
        return false;
    }

    const sendAsDocument = lowerText.startsWith('.mp3d') || lowerText.startsWith('#mp3d');

    const url = extractFirstUrl(text);
    if (!url) {
        await message.reply('⚠️ Debes enviar el enlace junto al comando. Ejemplo: *.mp3 https://...* o *.mp3d https://...*');
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
            await message.reply(sendAsDocument
                ? '🎵 Descargando audio en mp3 (documento), espera un momento...'
                : '🎵 Descargando audio en mp3, espera un momento...');
        }

        const { filePath, title, audioFileName } = await downloadAudio(url);
        downloadedFile = filePath;

        try {
            await appendDsDownloadLog(message.from, url, `${title} [${sendAsDocument ? 'mp3d' : 'mp3'}]`, filePath);
        } catch (logError) {
            console.warn(`No se pudo registrar descarga .${sendAsDocument ? 'mp3d' : 'mp3'} en TXT:`, logError?.message || logError);
        }

        if (sendAsDocument) {
            await sendAudioAsDocument(client, message.from, filePath, title, audioFileName);
        } else {
            await sendAudioInline(client, message.from, filePath, title, audioFileName);
        }
    } catch (error) {
        console.error(`Error descargando ${sendAsDocument ? 'mp3d' : 'mp3'}:`, error);
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
    handleAudioCommand
};
