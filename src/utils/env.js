function isTruthy(value) {
    return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

module.exports = {
    isTruthy
};
