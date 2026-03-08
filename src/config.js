require('dotenv').config();

const path = require('node:path');

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
    ffmpegMaxBufferMb: Math.max(1, Number(process.env.FFMPEG_MAX_BUFFER_MB || 4))
};

module.exports = {
    paths,
    limits,
    performance
};
