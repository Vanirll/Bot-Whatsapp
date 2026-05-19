const { isTruthy } = require('../utils/env');
const { accessControl, normalizeContactId } = require('../config');
const { BLOCKED_USER_MESSAGE } = require('../constants/bot');

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

function normalizeSenderCandidate(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.includes('@g.us') || raw.includes('@lid')) {
        return '';
    }

    return normalizeContactId(raw);
}

function isBlockedSender(senderId, blockedNumbers) {
    if (!senderId) {
        return false;
    }

    for (const blocked of blockedNumbers) {
        if (!blocked) {
            continue;
        }

        if (senderId === blocked || senderId.endsWith(blocked) || blocked.endsWith(senderId)) {
            return true;
        }
    }

    return false;
}

function isBlockedAnySender(senderIds, blockedNumbers) {
    for (const senderId of senderIds) {
        if (isBlockedSender(senderId, blockedNumbers)) {
            return true;
        }
    }

    return false;
}

function isBlockedRawSender(rawIds, blockedIds) {
    if (!blockedIds || blockedIds.size === 0) {
        return false;
    }

    for (const rawId of rawIds) {
        const normalizedRawId = String(rawId || '').trim().toLowerCase();
        if (!normalizedRawId) {
            continue;
        }

        if (blockedIds.has(normalizedRawId)) {
            return true;
        }
    }

    return false;
}

function getRawSenderIds(message) {
    return [
        message.author,
        message.id?.participant,
        message.id?._serialized,
        message._data?.author,
        message._data?.id?.participant,
        message._data?.id?._serialized,
        message.from
    ].filter(Boolean);
}

function extractNormalizedIdsFromSerialized(value) {
    const serialized = String(value || '').trim();
    if (!serialized || serialized.includes('@g.us') || serialized.includes('@lid')) {
        return [];
    }

    const matches = serialized.match(/\d{9,}/g) || [];
    return matches.map((candidate) => normalizeSenderCandidate(candidate)).filter(Boolean);
}

async function getNormalizedSenderIds(message) {
    const senderCandidates = getRawSenderIds(message);

    const normalizedIds = new Set();

    senderCandidates
        .map((candidate) => normalizeSenderCandidate(candidate))
        .filter(Boolean)
        .forEach((candidate) => normalizedIds.add(candidate));

    senderCandidates
        .flatMap((candidate) => extractNormalizedIdsFromSerialized(candidate))
        .forEach((candidate) => normalizedIds.add(candidate));

    try {
        const contact = await message.getContact();
        const contactCandidates = [
            contact?.id?._serialized,
            contact?.id?.user,
            contact?.number
        ];

        contactCandidates
            .map((candidate) => normalizeSenderCandidate(candidate))
            .filter(Boolean)
            .forEach((candidate) => normalizedIds.add(candidate));

        contactCandidates
            .flatMap((candidate) => extractNormalizedIdsFromSerialized(candidate))
            .forEach((candidate) => normalizedIds.add(candidate));

        return Array.from(normalizedIds);
    } catch {
        return Array.from(normalizedIds);
    }
}

function registerMessageHandler(client) {
    client.on('message', async (message) => {
        if (message.fromMe) {
            return;
        }

        const blockDebugEnabled = isTruthy(process.env.BLOCKED_DEBUG);

        const rawSenderIds = getRawSenderIds(message);
        const normalizedSenderIds = await getNormalizedSenderIds(message);

        if (blockDebugEnabled) {
            console.log('[block-check]', {
                from: message.from,
                author: message.author,
                participant: message.id?.participant,
                rawSenderIds,
                normalizedSenderIds,
                blockedNumbers: Array.from(accessControl.blockedNumbers),
                blockedIds: Array.from(accessControl.blockedIds)
            });
        }

        if (
            isBlockedAnySender(normalizedSenderIds, accessControl.blockedNumbers)
            || isBlockedRawSender(rawSenderIds, accessControl.blockedIds)
        ) {
            if (blockDebugEnabled) {
                console.log('[block-check] sender blocked');
            }

            await client.sendMessage(message.from, BLOCKED_USER_MESSAGE, { linkPreview: false });
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
