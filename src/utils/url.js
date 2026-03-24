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
    'redd.it',
    'pinterest.com',
    'pin.it'
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
    isPinterestUrl: (urlString) => {
        try {
            const { hostname } = new URL(urlString);
            return hostname === 'pin.it' || hostname.endsWith('.pin.it') || hostname === 'pinterest.com' || hostname.endsWith('.pinterest.com');
        } catch {
            return false;
        }
    },
    SUPPORTED_HOSTS
};
