const { MessageMedia } = require('whatsapp-web.js');

const {
    R34_ALLOWED_MEDIA_PATH,
    R34_VIDEO_EXTENSIONS,
    R34_IMAGE_EXTENSIONS
} = require('../../constants/bot');

function getUrlExtension(url) {
    try {
        const pathname = new URL(String(url || '')).pathname || '';
        const extension = pathname.includes('.') ? pathname.slice(pathname.lastIndexOf('.')).toLowerCase() : '';
        return extension;
    } catch {
        return '';
    }
}

function getR34MediaType(url) {
    const extension = getUrlExtension(url);

    if (R34_VIDEO_EXTENSIONS.has(extension)) {
        return 'video';
    }

    if (R34_IMAGE_EXTENSIONS.has(extension)) {
        return 'image';
    }

    return 'unknown';
}

function isAllowedR34MediaUrl(url) {
    let parsedUrl;
    try {
        parsedUrl = new URL(String(url || '').trim());
    } catch {
        return false;
    }

    const pathname = String(parsedUrl.pathname || '').toLowerCase();
    const includesImagesPath = pathname.includes(R34_ALLOWED_MEDIA_PATH);
    if (!includesImagesPath) {
        return false;
    }

    return getR34MediaType(parsedUrl.toString()) !== 'unknown';
}

async function sendR34Media(client, chatId, mediaUrl) {
    const mediaType = getR34MediaType(mediaUrl);
    const extension = getUrlExtension(mediaUrl) || (mediaType === 'video' ? '.mp4' : '.jpg');
    const isVideo = mediaType === 'video';

    const media = await MessageMedia.fromUrl(mediaUrl, {
        unsafeMime: true,
        filename: `r34-${Date.now()}${extension}`
    });

    const mustSendAsDocument = isVideo && extension === '.webm';

    try {
        await client.sendMessage(chatId, media, {
            sendMediaAsDocument: mustSendAsDocument,
            sendVideoAsGif: false
        });
    } catch (error) {
        if (!isVideo || mustSendAsDocument) {
            throw error;
        }

        await client.sendMessage(chatId, media, {
            sendMediaAsDocument: true,
            sendVideoAsGif: false
        });
    }

    return mediaType;
}

module.exports = {
    getUrlExtension,
    getR34MediaType,
    isAllowedR34MediaUrl,
    sendR34Media
};
