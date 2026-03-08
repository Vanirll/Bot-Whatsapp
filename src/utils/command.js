function extractCommandArgument(text, command) {
    const expression = new RegExp(`^[.#]${command}\\s*`, 'i');
    return String(text || '').replace(expression, '').trim();
}

module.exports = {
    extractCommandArgument
};
