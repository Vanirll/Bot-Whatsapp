const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const YTDlpWrap = require('yt-dlp-wrap').default;
const ffmpegPath = require('ffmpeg-static');

const { paths, limits, performance } = require('../config');

const ytDlp = new YTDlpWrap(paths.ytDlpBinary);
const execFileAsync = promisify(execFile);

async function ensureTempDir() {
    await fs.mkdir(paths.tempDir, { recursive: true });
}

async function ensureYtDlpBinary() {
    await fs.mkdir(paths.binDir, { recursive: true });

    try {
        await fs.access(paths.ytDlpBinary);
    } catch {
        console.log('Descargando yt-dlp...');
        await YTDlpWrap.downloadFromGithub(paths.ytDlpBinary);
    }
}

async function findDownloadedFile(prefix) {
    const entries = await fs.readdir(paths.tempDir);
    const matchedEntries = entries.filter((name) => name.startsWith(prefix));

    const preferredVideoExtensions = ['.mp4', '.webm', '.mkv', '.mov', '.m4v', '.avi'];
    const match = matchedEntries.find((name) => {
        const extension = path.extname(name).toLowerCase();
        return preferredVideoExtensions.includes(extension);
    }) || matchedEntries[0];

    if (!match) {
        throw new Error('No se encontró el archivo descargado.');
    }

    return path.join(paths.tempDir, match);
}

async function safeCleanup(filePath) {
    if (!filePath) return;

    try {
        await fs.unlink(filePath);
    } catch {
        // ignore cleanup errors
    }
}

async function convertToWhatsAppVideo(inputPath, prefix) {
    if (!ffmpegPath) {
        throw new Error('FFMPEG_NOT_AVAILABLE');
    }

    const outputPath = path.join(paths.tempDir, `${prefix}-wa.mp4`);
    await safeCleanup(outputPath);

    const args = [
        '-y',
        '-i',
        inputPath,
        '-f',
        'lavfi',
        '-i',
        'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-shortest',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '27',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        outputPath
    ];

    try {
        await execFileAsync(ffmpegPath, args, {
            windowsHide: true,
            maxBuffer: performance.ffmpegMaxBufferMb * 1024 * 1024
        });
    } catch (error) {
        const ffmpegError = String(error?.stderr || error?.message || 'FFMPEG_CONVERSION_FAILED').trim();
        throw new Error(`FFMPEG_CONVERSION_FAILED: ${ffmpegError}`);
    }

    await safeCleanup(inputPath);
    return outputPath;
}

async function downloadVideo(url) {
    await ensureTempDir();

    const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const outputTemplate = path.join(paths.tempDir, `${id}.%(ext)s`);

    let metadata = null;
    try {
        metadata = await ytDlp.getVideoInfo(url);
    } catch {
        metadata = null;
    }

    const baseArgs = [
        url,
        '-o',
        outputTemplate,
        '--no-playlist',
        '--no-warnings',
        '--no-check-certificates',
        '--concurrent-fragments',
        '1',
        '--retries',
        '2',
        '--max-filesize',
        `${limits.maxFileSizeMb}M`
    ];

    const formatCandidates = [
        'best*[height<=720][vcodec!=none][acodec!=none]/best[height<=720]/best*[vcodec!=none][acodec!=none]/best',
        'bestvideo[height<=720][vcodec!=none]/bestvideo[vcodec!=none]',
        'best*[vcodec!=none][acodec!=none]/best'
    ];

    let lastError = null;
    for (let index = 0; index < formatCandidates.length; index += 1) {
        const format = formatCandidates[index];
        try {
            await ytDlp.execPromise([...baseArgs, '-f', format]);
            lastError = null;
            break;
        } catch (error) {
            lastError = error;
            const message = String(error?.stderr || error?.message || '');
            const canRetry = /requested format is not available/i.test(message);
            const isLastCandidate = index === formatCandidates.length - 1;
            if (!canRetry || isLastCandidate) {
                throw error;
            }
        }
    }

    if (lastError) {
        throw lastError;
    }

    const downloadedPath = await findDownloadedFile(id);
    const filePath = await convertToWhatsAppVideo(downloadedPath, id);
    const stats = await fs.stat(filePath);

    if (stats.size > limits.maxFileSizeBytes) {
        await safeCleanup(filePath);
        throw new Error(`El archivo supera el límite de ${limits.maxFileSizeMb}MB.`);
    }

    const title = metadata?.title || 'Video descargado';
    return { filePath, title };
}

module.exports = {
    ensureYtDlpBinary,
    downloadVideo,
    safeCleanup
};
