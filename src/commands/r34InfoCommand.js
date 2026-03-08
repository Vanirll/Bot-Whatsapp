const { getLastR34Result } = require('../services/r34/history');
const { formatR34InfoReply } = require('../services/r34/info');

async function handleR34InfoCommand({ client, message, lowerText }) {
    if (lowerText !== '.34info' && lowerText !== '#34info') {
        return false;
    }

    const lastResult = getLastR34Result(message.from);

    if (!lastResult) {
        await message.reply('⚠️ Aun no hay resultados r34 en este chat. Usa *.r34 nombre_del_personaje* primero.');
        return true;
    }

    const infoMessage = formatR34InfoReply(lastResult.characterName, lastResult.result, lastResult.mediaType);

    await client.sendMessage(message.from, infoMessage, {
        linkPreview: false
    });

    return true;
}

module.exports = {
    handleR34InfoCommand
};
