const { getReadableError } = require('../utils/errors');
const { BOT_STICKER_NAME } = require('../constants/bot');
const { getCommandUserName, getStickerSourceMedia } = require('../services/stickerService');

function formatStickerDate(date = new Date()) {
    return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
}

function buildStickerMetadata(requesterName) {
    const formattedDate = formatStickerDate();

    return {
        stickerName: BOT_STICKER_NAME.toUpperCase(),
        stickerAuthor: `\n Usuario: ${requesterName}\nFecha: ${formattedDate}\n> Desarrollado por Vanirbot`
    };
}

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
        const stickerMetadata = buildStickerMetadata(requesterName);

        await client.sendMessage(message.from, media, {
            sendMediaAsSticker: true,
            ...stickerMetadata
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
