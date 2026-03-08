const { MessageMedia } = require('whatsapp-web.js');

async function sendMediaWithFallback(client, chatId, filePath, title, allowDocumentFallback) {
    try {
        const media = MessageMedia.fromFilePath(filePath);
        await client.sendMessage(chatId, media, {
            caption: `✅ ${title}`,
            sendMediaAsDocument: false,
            sendVideoAsGif: false
        });
        return;
    } catch {
        // Retry once because whatsapp-web may fail sporadically.
    }

    try {
        const mediaRetry = MessageMedia.fromFilePath(filePath);
        await client.sendMessage(chatId, mediaRetry, {
            caption: `✅ ${title}`,
            sendMediaAsDocument: false,
            sendVideoAsGif: false
        });
        return;
    } catch (error) {
        if (!allowDocumentFallback) {
            throw new Error('No se pudo enviar el archivo como video. Si quieres permitir documento, activa ALLOW_DOCUMENT_FALLBACK=true.');
        }

        console.warn('Fallo envio como video, enviando como documento:', error?.message || error);
        const mediaDoc = MessageMedia.fromFilePath(filePath);
        await client.sendMessage(chatId, mediaDoc, {
            caption: `✅ ${title}`,
            sendMediaAsDocument: true
        });
    }
}

module.exports = {
    sendMediaWithFallback
};
