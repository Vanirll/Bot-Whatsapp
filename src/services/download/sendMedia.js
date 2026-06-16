const { MessageMedia } = require('whatsapp-web.js');
const fs = require('node:fs');

async function sendMediaWithFallback(client, chatId, filePath, title, allowDocumentFallback) {
    const stats = fs.statSync(filePath);
    const fileSizeMb = (stats.size / (1024 * 1024)).toFixed(2);

    // Leer UNA sola vez en lugar de 3 veces
    const media = MessageMedia.fromFilePath(filePath);

    const trySend = async (asDocument) => {
        console.log(); // ← asegura nueva línea después del progreso de descarga
        const startAt = Date.now();
        process.stdout.write(`📤 Enviando${asDocument ? ' (documento)' : ''}: ${fileSizeMb} MB...`);

        console.log("[SEND] Path:", filePath);
        console.log("[SEND] Size:", stats.size);
        console.log("[SEND] Mime:", media.mimetype);
        await client.sendMessage(chatId, media, {
            caption: `✅ ${title}`,
            sendMediaAsDocument: asDocument,
            sendVideoAsGif: false
        });

        const elapsedSec = ((Date.now() - startAt) / 1000).toFixed(1);
        const speedMbps = (fileSizeMb / elapsedSec).toFixed(2);
        console.log(` ✅ Enviado en ${elapsedSec}s a ~${speedMbps} MB/s`);
    };

    try {
        await trySend(false);
        return;
    } catch (error) {
        console.error("[SEND ERROR 1]", error);
    }

    try {
        await trySend(false);
        return;
    } catch (error) {
        console.error("[SEND ERROR 2]", error);

        if (!allowDocumentFallback) {
            throw new Error(
                'No se pudo enviar el archivo como video. Si quieres permitir documento, activa ALLOW_DOCUMENT_FALLBACK=true.'
            );
        }

        await trySend(true);
    }
}

module.exports = { sendMediaWithFallback };