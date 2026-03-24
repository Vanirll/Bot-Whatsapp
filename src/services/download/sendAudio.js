const fs = require('node:fs/promises');
const { MessageMedia } = require('whatsapp-web.js');

async function createInlineAudioMedia(filePath, fileName) {
    const buffer = await fs.readFile(filePath);
    const base64Data = buffer.toString('base64');
    return new MessageMedia('audio/mpeg', base64Data, fileName || 'audio.mp3');
}

async function sendAudioInline(client, chatId, filePath, title, fileName) {
    try {
        const media = await createInlineAudioMedia(filePath, fileName);
        await client.sendMessage(chatId, media, {
            sendMediaAsDocument: false
        });
        await client.sendMessage(chatId, `✅ ${title}`);
        return;
    } catch {
        // Fallback to document for clients that fail inline audio.
    }

    await sendAudioAsDocument(client, chatId, filePath, title, fileName);
}

async function sendAudioAsDocument(client, chatId, filePath, title, fileName) {
    const mediaDoc = MessageMedia.fromFilePath(filePath);
    if (fileName) {
        mediaDoc.filename = fileName;
    }
    await client.sendMessage(chatId, mediaDoc, {
        sendMediaAsDocument: true,
        caption: `✅ ${title}`
    });
}

module.exports = {
    sendAudioInline,
    sendAudioAsDocument
};
