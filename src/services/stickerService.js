function isStickerConvertibleMedia(media) {
    const mimetype = String(media?.mimetype || '').toLowerCase();
    return mimetype.startsWith('image/') || mimetype.startsWith('video/');
}

async function getCommandUserName(message) {
    try {
        const contact = await message.getContact();
        return contact?.pushname || contact?.name || contact?.shortName || contact?.number || 'Usuario';
    } catch {
        return 'Usuario';
    }
}

async function getStickerSourceMedia(message) {
    if (message?.hasMedia) {
        const ownMedia = await message.downloadMedia();
        if (isStickerConvertibleMedia(ownMedia)) {
            return ownMedia;
        }
    }

    if (message?.hasQuotedMsg) {
        const quotedMessage = await message.getQuotedMessage();
        if (quotedMessage?.hasMedia) {
            const quotedMedia = await quotedMessage.downloadMedia();
            if (isStickerConvertibleMedia(quotedMedia)) {
                return quotedMedia;
            }
        }
    }

    return null;
}

module.exports = {
    getCommandUserName,
    getStickerSourceMedia
};
