require('dotenv').config();

const path = require('node:path');

function normalizeContactId(value) {
    const chatId = String(value || '').trim();
    const withoutSuffix = chatId.split('@')[0] || '';
    return withoutSuffix.replace(/\D/g, '');
}

function parseBlockedNumbers(value) {
    const tokens = String(value || '')
        .split(/[\s,;]+/)
        .map((token) => normalizeContactId(token))
        .filter((token) => token.length >= 9);

    return new Set(tokens);
}

function parseBlockedIds(value) {
    return new Set(
        String(value || '')
            .split(/[\s,;]+/)
            .map((token) => String(token || '').trim().toLowerCase())
            .filter(Boolean)
    );
}

const maxFileSizeMbRaw = Number(process.env.MAX_FILE_SIZE_MB || 60);
const maxFileSizeMb = Number.isFinite(maxFileSizeMbRaw) && maxFileSizeMbRaw > 0 ? maxFileSizeMbRaw : 60;

const paths = {
    tempDir: path.resolve(process.cwd(), 'temp'),
    binDir: path.resolve(process.cwd(), 'bin'),
    ytDlpBinary: path.join(
        path.resolve(process.cwd(), 'bin'),
        process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
    ),
    sessionPath: process.env.SESSION_PATH || '.session'
};

const limits = {
    maxFileSizeMb,
    maxFileSizeBytes: maxFileSizeMb * 1024 * 1024
};

const performance = {
    maxConcurrentDownloads: Math.max(1, Number(process.env.MAX_CONCURRENT_DOWNLOADS || 1)),
    ffmpegMaxBufferMb: Math.max(1, Number(process.env.FFMPEG_MAX_BUFFER_MB || 4)),
    // Timeout for ffmpeg operations in milliseconds (default: 5 minutes)
    ffmpegTimeoutMs: Math.max(30_000, Number(process.env.FFMPEG_TIMEOUT_MS || 5 * 60 * 1000)),
    // Download optimization: concurrent fragments (1-8, default 4)
    downloadConcurrentFragments: Math.max(1, Math.min(8, Number(process.env.DOWNLOAD_CONCURRENT_FRAGMENTS || 4))),
    // Download retry count for failed chunks
    downloadRetries: Math.max(2, Number(process.env.DOWNLOAD_RETRIES || 5)),
    // Speed limit in bytes/sec (0 = no limit, default: 100KB/s)
    downloadSpeedLimit: Math.max(0, Number(process.env.DOWNLOAD_SPEED_LIMIT || 102400)),
    // Timeout in seconds for videoInfo caching (default: 5 minutes)
    videoInfoCacheTtlSeconds: Math.max(60, Number(process.env.VIDEO_INFO_CACHE_TTL_SECONDS || 300)),
    // Use browser cookies for TikTok downloads (to bypass restrictions)
    useBrowserCookies: String(process.env.TT_USE_BROWSER_COOKIES || 'true').toLowerCase() === 'true',
    // Browser to use for cookie extraction (chrome, firefox, edge, safari, brave, vivaldi)
    browserForCookies: String(process.env.TT_BROWSER || 'chrome').toLowerCase().trim(),
    // Optional proxy for TikTok downloads
    tikTokProxyUrl: String(process.env.TT_PROXY_URL || '').trim(),
    // Optional cookies.txt path for TikTok downloads
    tikTokCookiesFile: String(process.env.TT_COOKIES_FILE || '').trim()
};

const accessControl = {
    blockedNumbers: parseBlockedNumbers(process.env.BLOCKED_NUMBERS),
    blockedIds: parseBlockedIds(process.env.BLOCKED_IDS)
};

module.exports = {
    paths,
    limits,
    performance,
    accessControl,
    normalizeContactId
};
