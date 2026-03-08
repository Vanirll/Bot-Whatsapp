const { getReadableError } = require('../utils/errors');
const { BOT_STICKER_NAME } = require('../constants/bot');
const { getCommandUserName, getStickerSourceMedia } = require('../services/stickerService');

async function handleStickerCommand({ client, message, text }) {
    const isStickerCommand = /^[.#]s(?:\s|$)/i.test(text);
    if (!isStickerCommand) {
        return false;
    }

    try {
        const media = await getStickerSourceMedia(message);
        if (!media) {
            await message.reply('⚠️ Usa *.s* junto a una imagen/video o respondiendo a una imagen/video.');
            return true;
        }

        const requesterName = await getCommandUserName(message);
        await client.sendMessage(message.from, media, {
            sendMediaAsSticker: true,
            stickerName: BOT_STICKER_NAME,
            stickerAuthor: requesterName
        });
    } catch (error) {
        const reason = getReadableError(error);
        await message.reply(`❌ Error creando sticker: ${reason}`);
    }

    return true;
}

module.exports = {
    handleStickerCommand
};
