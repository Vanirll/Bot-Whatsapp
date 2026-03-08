const { getReadableError } = require('../utils/errors');
const { extractCommandArgument } = require('../utils/command');
const { appendR34SearchLog } = require('../repositories/logRepository');
const { searchCharacterWithoutRepeat } = require('../services/r34/searchService');
const { isAllowedR34MediaUrl, getR34MediaType, sendR34Media } = require('../services/r34/media');
const { setLastR34Result, registerR34PostInHistory } = require('../services/r34/history');

async function handleR34Command({ client, message, lowerText, text, options }) {
    const isR34Command = lowerText.startsWith('.r34') || lowerText.startsWith('#r34');
    if (!isR34Command) {
        return false;
    }

    const characterName = extractCommandArgument(text, 'r34');

    if (!characterName) {
        await message.reply('⚠️ Uso: *.r34 nombre_del_personaje*');
        return true;
    }

    try {
        await message.reply('🔎 Buscando personaje en r34...');

        const result = await searchCharacterWithoutRepeat(message.from, characterName);

        if (!result) {
            await message.reply(`❌ No encontre resultados para *${characterName}* sin repetir mas de una vez.`);
            return true;
        }

        if (!isAllowedR34MediaUrl(result.mediaUrl)) {
            await message.reply('⚠️ No encontre un archivo valido (imagen/video) con ruta `/images/` para este personaje.');
            return true;
        }

        let mediaType = getR34MediaType(result.mediaUrl);

        try {
            mediaType = await sendR34Media(client, message.from, result.mediaUrl);
        } catch (sendError) {
            console.warn('No se pudo enviar media r34, enviando enlace:', sendError?.message || sendError);
            await client.sendMessage(
                message.from,
                `⚠️ No pude enviar el archivo, pero aqui tienes el enlace:\n${result.mediaUrl}`,
                { linkPreview: false }
            );
            mediaType = `${mediaType}-link`;
        }

        setLastR34Result(message.from, {
            characterName,
            result,
            mediaType,
            sentAt: Date.now()
        });
        registerR34PostInHistory(message.from, result.id);

        if (options.saveR34Searches) {
            try {
                await appendR34SearchLog(
                    message.from,
                    characterName,
                    result,
                    mediaType
                );
            } catch (saveError) {
                console.warn('No se pudo guardar r34 en TXT:', saveError?.message || saveError);
            }
        }
    } catch (error) {
        const reason = getReadableError(error);
        await message.reply(`❌ Error r34: ${reason}`);
    }

    return true;
}

module.exports = {
    handleR34Command
};
