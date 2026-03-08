const SUPPORTED_HOSTS = [
    'youtube.com',
    'youtu.be',
    'tiktok.com',
    'instagram.com',
    'instagr.am',
    'facebook.com',
    'fb.watch',
    'twitter.com',
    'x.com',
    'reddit.com',
    'redd.it'
];

function extractFirstUrl(text) {
    if (!text) return null;

    const match = text.match(/https?:\/\/[^\s]+/i);
    if (!match) return null;

    return match[0].trim().replace(/[)\]}>.,!?]+$/, '');
}

function isSupportedUrl(urlString) {
    try {
        const { hostname } = new URL(urlString);
        return SUPPORTED_HOSTS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    } catch {
        return false;
    }
}

module.exports = {
    extractFirstUrl,
    isSupportedUrl,
    SUPPORTED_HOSTS
};
