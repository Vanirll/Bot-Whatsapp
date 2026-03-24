const { isTruthy } = require('../utils/env');

const { handlePingCommand } = require('../commands/pingCommand');
const { handleMenuCommand } = require('../commands/menuCommand');
const { handleStickerCommand } = require('../commands/stickerCommand');
const { handleR34InfoCommand } = require('../commands/r34InfoCommand');
const { handleR34Command } = require('../commands/r34Command');
const { handleSearchDownloadCommand } = require('../commands/searchDownloadCommand');
const { handleDownloadCommand } = require('../commands/downloadCommand');
const { handleAudioCommand } = require('../commands/audioCommand');
const { handlePinterestCommand } = require('../commands/pinterestCommand');

const commandHandlers = [
    handlePingCommand,
    handleMenuCommand,
    handleStickerCommand,
    handleR34InfoCommand,
    handleR34Command,
    handleSearchDownloadCommand,
    handlePinterestCommand,
    handleDownloadCommand,
    handleAudioCommand
];

function registerMessageHandler(client) {
    client.on('message', async (message) => {
        if (message.fromMe) {
            return;
        }

        const text = (message.body || '').trim();
        const lowerText = text.toLowerCase();

        const options = {
            keepDownloadedFiles: isTruthy(process.env.KEEP_DOWNLOADED_FILES),
            saveR34Searches: process.env.SAVE_R34_SEARCHES === undefined
                ? true
                : isTruthy(process.env.SAVE_R34_SEARCHES)
        };

        for (const handler of commandHandlers) {
            const handled = await handler({
                client,
                message,
                text,
                lowerText,
                options
            });

            if (handled) {
                return;
            }
        }
    });
}

module.exports = {
    registerMessageHandler
};
