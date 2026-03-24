const { extractCommandArgument } = require('../utils/command');
const { isTruthy } = require('../utils/env');
const { getReadableError } = require('../utils/errors');
const { downloadVideo, searchVideosByTitle, safeCleanup } = require('../services/downloader');
const { appendDsDownloadLog } = require('../repositories/logRepository');
const { acquireDownloadSlot, getActiveDownloads } = require('../services/download/queue');
const { sendMediaWithFallback } = require('../services/download/sendMedia');

const pendingSearchesByChat = new Map();

function formatSearchResultsMessage(query, results) {
    const lines = [
        `🔎 *Resultados para:* ${query}`,
        ''
    ];

    results.forEach((item, index) => {
        lines.push(`${index + 1}. ${item.title}`);
        lines.push(`   Hecho por: ${item.author}`);
        lines.push(`   Fecha: ${item.publishedAt || 'Desconocida'}`);
        lines.push(`   Peso: ${item.sizeMb || 'Desconocido'}`);
    });

    lines.push('');
    lines.push('Responde con *.dsb 1*, *.dsb 2* o *.dsb 3* para descargar.');
    return lines.join('\n');
}

async function handleSearchDownloadCommand({ client, message, text, options }) {
    const isSearchDownloadCommand = /^[.#]dsb(?:\s|$)/i.test(text);
    if (!isSearchDownloadCommand) {
        return false;
    }

    const query = extractCommandArgument(text, 'dsb');
    if (!query) {
        await message.reply('⚠️ Uso: *.dsb titulo_del_video* para buscar o *.dsb 1* para descargar un resultado.');
        return true;
    }

    const selectedIndex = Number(query);
    const canSelectResult = Number.isInteger(selectedIndex) && selectedIndex >= 1 && selectedIndex <= 3;

    if (!canSelectResult) {
        try {
            await message.reply(`🔎 Buscando: *${query}* ...`);
            const results = await searchVideosByTitle(query, 3);

            if (results.length === 0) {
                await message.reply('⚠️ No encontre resultados para esa busqueda.');
                return true;
            }

            pendingSearchesByChat.set(message.from, {
                query,
                results,
                createdAt: Date.now()
            });

            await client.sendMessage(message.from, formatSearchResultsMessage(query, results), {
                linkPreview: false
            });
        } catch (error) {
            const reason = getReadableError(error);
            await message.reply(`❌ Error en busqueda: ${reason}`);
        }

        return true;
    }

    const pending = pendingSearchesByChat.get(message.from);
    if (!pending || !Array.isArray(pending.results) || pending.results.length === 0) {
        await message.reply('⚠️ No hay una busqueda activa. Usa *.dsb titulo_del_video* primero.');
        return true;
    }

    const selected = pending.results[selectedIndex - 1];
    if (!selected || !selected.sourceUrl) {
        await message.reply('⚠️ El numero elegido no tiene URL valida. Repite la busqueda con *.dsb titulo*.');
        return true;
    }

    let downloadedFile = null;
    const releaseSlot = await acquireDownloadSlot();

    try {
        if (getActiveDownloads() > 1) {
            await message.reply(`🕒 Hay cola de descargas. Tu seleccion esta en espera (activos: ${getActiveDownloads()}).`);
        } else {
            await message.reply(`⏬ Descargando resultado ${selectedIndex}: *${selected.title}*`);
        }

        const { filePath, title } = await downloadVideo(selected.sourceUrl);
        downloadedFile = filePath;

        try {
            await appendDsDownloadLog(message.from, selected.sourceUrl || `Busqueda: ${pending.query}`, title, filePath);
        } catch (logError) {
            console.warn('No se pudo registrar descarga .dsb en TXT:', logError?.message || logError);
        }

        await sendMediaWithFallback(
            client,
            message.from,
            filePath,
            title,
            isTruthy(process.env.ALLOW_DOCUMENT_FALLBACK)
        );

        pendingSearchesByChat.delete(message.from);
    } catch (error) {
        console.error('Error en .dsb:', error);
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
    handleSearchDownloadCommand
};
