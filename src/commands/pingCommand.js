async function handlePingCommand({ message, lowerText }) {
    if (lowerText !== '.ping' && lowerText !== '#ping') {
        return false;
    }

    const startedAt = Date.now();
    await message.reply('🏓 Pong...');
    const latencyMs = Date.now() - startedAt;
    await message.reply(`⚡ Latencia: ${latencyMs} ms`);
    return true;
}

module.exports = {
    handlePingCommand
};
