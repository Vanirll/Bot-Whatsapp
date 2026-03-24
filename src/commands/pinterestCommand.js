const { extractCommandArgument } = require('../utils/command');
const { extractFirstUrl, isPinterestUrl } = require('../utils/url');
const { getReadableError } = require('../utils/errors');
const {
    searchPinterestMedia,
    downloadPinterestMedia,
    downloadPinterestSearchItem,
    safeCleanup
} = require('../services/downloader');
const { appendPtDownloadLog } = require('../repositories/logRepository');
const { acquireDownloadSlot, getActiveDownloads } = require('../services/download/queue');
const { sendMediaWithFallback } = require('../services/download/sendMedia');
const { isTruthy } = require('../utils/env');

function resolvePinterestSearchInput(argumentText) {
    const clean = String(argumentText || '').trim();
    if (!clean) {
        return { query: '', quantity: 3, wasCapped: false };
    }

    const quantityMatch = clean.match(/^(.*?)(?:\s+(\d{1,2}))$/);
    if (!quantityMatch) {
        return { query: clean, quantity: 3, wasCapped: false };
    }

    const query = String(quantityMatch[1] || '').trim();
    const requested = Number(quantityMatch[2]);
    if (!query || !Number.isFinite(requested)) {
        return { query: clean, quantity: 3, wasCapped: false };
    }

    const quantity = Math.max(1, Math.min(15, requested));
    return {
        query,
        quantity,
        wasCapped: requested > 15
    };
}

async function handlePinterestCommand({ client, message, text, options }) {
    const isPinterestCommand = /^[.#]pt(?:\s|$)/i.test(text);
    if (!isPinterestCommand) {
        return false;
    }

    const argument = extractCommandArgument(text, 'pt');
    if (!argument) {
        await message.reply('⚠️ Uso: *.pt <busqueda> <cantidad>* (max 15) o *.pt <url_de_pinterest>*');
        return true;
    }

    const maybeUrl = extractFirstUrl(argument);
    const allowDocumentFallback = isTruthy(process.env.ALLOW_DOCUMENT_FALLBACK);

    if (maybeUrl) {
        if (!isPinterestUrl(maybeUrl)) {
            await message.reply('⚠️ El enlace debe ser de Pinterest (pinterest.com o pin.it).');
            return true;
        }

        let downloadedFile = null;
        const releaseSlot = await acquireDownloadSlot();

        try {
            if (getActiveDownloads() > 1) {
                await message.reply(`🕒 Hay cola de descargas. Tu turno esta en espera (activos: ${getActiveDownloads()}).`);
            } else {
                await message.reply('📌 Descargando media de Pinterest, espera un momento...');
            }

            const result = await downloadPinterestMedia(maybeUrl, 'Pinterest');
            downloadedFile = result.filePath;

            try {
                await appendPtDownloadLog(message.from, result.sourceUrl, result.title, result.filePath, result.mediaType);
            } catch (logError) {
                console.warn('No se pudo registrar descarga .pt en logs:', logError?.message || logError);
            }

            await sendMediaWithFallback(client, message.from, result.filePath, result.title, allowDocumentFallback);
        } catch (error) {
            const reason = getReadableError(error);
            await message.reply(`❌ Error en Pinterest: ${reason}`);
        } finally {
            if (!options.keepDownloadedFiles) {
                await safeCleanup(downloadedFile);
            }

            releaseSlot();
        }

        return true;
    }

    const { query, quantity, wasCapped } = resolvePinterestSearchInput(argument);
    if (!query) {
        await message.reply('⚠️ Debes indicar una busqueda. Ejemplo: *.pt gatos aesthetic 5*');
        return true;
    }

    const releaseSlot = await acquireDownloadSlot();
    let sentCount = 0;
    let failedCount = 0;

    try {
        if (wasCapped) {
            await message.reply('ℹ️ El maximo permitido es 15 imagenes. Se enviaran 15 resultados.');
        }

        await message.reply(`🔎 Buscando en Pinterest: *${query}* (cantidad: ${quantity})...`);
        const results = await searchPinterestMedia(query, quantity);

        if (results.length === 0) {
            await message.reply('⚠️ No encontre resultados en Pinterest para esa busqueda.');
            return true;
        }

        await message.reply(`📌 Encontre ${results.length} resultado(s). Enviando...`);

        for (const item of results.slice(0, quantity)) {
            let downloadedFile = null;

            try {
                const downloaded = await downloadPinterestSearchItem(item);
                downloadedFile = downloaded.filePath;

                await sendMediaWithFallback(
                    client,
                    message.from,
                    downloaded.filePath,
                    downloaded.title,
                    allowDocumentFallback
                );

                sentCount += 1;

                try {
                    await appendPtDownloadLog(
                        message.from,
                        downloaded.sourceUrl || downloaded.mediaUrl,
                        downloaded.title,
                        downloaded.filePath,
                        downloaded.mediaType
                    );
                } catch (logError) {
                    console.warn('No se pudo registrar resultado .pt en logs:', logError?.message || logError);
                }
            } catch (itemError) {
                failedCount += 1;
                console.warn('No se pudo enviar resultado .pt:', itemError?.message || itemError);
            } finally {
                if (!options.keepDownloadedFiles) {
                    await safeCleanup(downloadedFile);
                }
            }
        }

        if (sentCount === 0) {
            await message.reply('⚠️ No pude enviar resultados validos de Pinterest para esa busqueda.');
        } else if (failedCount > 0) {
            await message.reply(`✅ Enviadas ${sentCount} media(s) de Pinterest. Fallaron ${failedCount}.`);
        } else {
            await message.reply(`✅ Enviadas ${sentCount} media(s) de Pinterest.`);
        }
    } catch (error) {
        const reason = getReadableError(error);
        await message.reply(`❌ Error en Pinterest: ${reason}`);
    } finally {
        releaseSlot();
    }

    return true;
}

module.exports = {
    handlePinterestCommand
};
