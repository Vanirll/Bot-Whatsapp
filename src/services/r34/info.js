function formatR34InfoReply(character, result, mediaType) {
    const tagPreview = Array.isArray(result?.tags)
        ? result.tags.slice(0, 12).join(', ') || 'sin tags'
        : 'sin tags';

    return (
        `ℹ️ *Ultimo r34 enviado*\n` +
        `• Personaje: ${character || 'N/A'}\n` +
        `• ID: ${result?.id || 'N/A'}\n` +
        `• Tipo: ${mediaType || 'N/A'}\n` +
        `• Rating: ${result?.rating || 'N/A'}\n` +
        `• Score: ${result?.score || 0}\n` +
        `• Tags: ${tagPreview}\n` +
        `${result?.mediaUrl || 'Sin URL de archivo'}`
    );
}

module.exports = {
    formatR34InfoReply
};
