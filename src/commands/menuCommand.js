const { MessageMedia } = require('whatsapp-web.js');

const { MENU_TEXT } = require('../constants/bot');

async function handleMenuCommand({ client, message, lowerText }) {
    if (lowerText !== '.menu' && lowerText !== '#menu') {
        return false;
    }

    const configuredUrl = String(process.env.MENU_IMAGE_URL || '').trim();
    const imageUrl = configuredUrl;

    if (imageUrl) {
        try {
            const media = await MessageMedia.fromUrl(imageUrl, {
                unsafeMime: true
            });

            await client.sendMessage(message.from, media, {
                caption: MENU_TEXT,
                sendMediaAsDocument: false
            });

            return true;
        } catch (error) {
            console.warn('No se pudo enviar imagen del menu, enviando solo texto:', error?.message || error);
        }
    }

    await client.sendMessage(message.from, MENU_TEXT, { linkPreview: false });
    return true;
}

module.exports = {
    handleMenuCommand
};
