const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { spawn } = require('node:child_process');
const { promisify } = require('node:util');
const YTDlpWrap = require('yt-dlp-wrap').default;
const ffmpegPath = require('ffmpeg-static');

const { paths, limits, performance } = require('../config');

const ytDlp = new YTDlpWrap(paths.ytDlpBinary);
const execFileAsync = promisify(execFile);
const recentPinterestResultsByQuery = new Map();
const videoInfoCache = new Map();  // Cache videoInfo to avoid redundant queries

async function execFFmpeg(args, opts = {}) {
    const maxBuffer = Number(opts.maxBufferBytes || performance.ffmpegMaxBufferMb * 1024 * 1024);
    const timeoutMs = Number(opts.timeoutMs || performance.ffmpegTimeoutMs || 5 * 60 * 1000);

    return new Promise((resolve, reject) => {
        let finished = false;
        let stdout = '';
        let stderr = '';

        const child = spawn(ffmpegPath, args, { windowsHide: true });

        const killAndReject = (err) => {
            if (finished) return;
            finished = true;
            try { child.kill('SIGKILL'); } catch (_) {}
            reject(err);
        };

        const timer = setTimeout(() => {
            killAndReject(new Error(`FFMPEG_TIMEOUT: exceeded ${timeoutMs}ms`));
        }, timeoutMs);

        child.stdout.on('data', (chunk) => {
            stdout += String(chunk || '');
            if (stdout.length > maxBuffer) {
                clearTimeout(timer);
                killAndReject(new Error('FFMPEG_STDOUT_EXCEEDED_MAX_BUFFER'));
            }
        });

        child.stderr.on('data', (chunk) => {
            stderr += String(chunk || '');
            if (stderr.length > maxBuffer) {
                clearTimeout(timer);
                killAndReject(new Error('FFMPEG_STDERR_EXCEEDED_MAX_BUFFER'));
            }
        });

        child.on('error', (err) => {
            clearTimeout(timer);
            killAndReject(err);
        });

        child.on('close', (code, signal) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                const message = stderr || `FFmpeg exited with code ${code || 'unknown'}${signal ? ' signal ' + signal : ''}`;
                reject(new Error(message));
            }
        });
    });
}

function shuffleArray(items) {
    const values = Array.isArray(items) ? [...items] : [];
    for (let index = values.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [values[index], values[randomIndex]] = [values[randomIndex], values[index]];
    }
    return values;
}

function createPinterestResultKey(item) {
    return String(item?.mediaUrl || item?.sourceUrl || '').trim();
}

function normalizeQueryKey(query) {
    return String(query || '').trim().toLowerCase();
}

function getRecentPinterestResultSet(query) {
    const key = normalizeQueryKey(query);
    if (!key) {
        return new Set();
    }

    const values = recentPinterestResultsByQuery.get(key) || [];
    return new Set(values);
}

function rememberPinterestResults(query, selectedResults) {
    const key = normalizeQueryKey(query);
    if (!key) {
        return;
    }

    const previous = recentPinterestResultsByQuery.get(key) || [];
    const currentKeys = selectedResults
        .map((item) => createPinterestResultKey(item))
        .filter(Boolean);

    const merged = [...previous, ...currentKeys];
    const deduped = [...new Set(merged)];
    const maxHistory = 120;
    const trimmed = deduped.slice(Math.max(0, deduped.length - maxHistory));
    recentPinterestResultsByQuery.set(key, trimmed);
}

function pickPinterestResults(query, candidates, limit) {
    const requestedLimit = Math.max(1, Number(limit) || 1);
    const shuffled = shuffleArray(candidates);
    const recentSet = getRecentPinterestResultSet(query);
    const fresh = [];
    const repeated = [];

    for (const item of shuffled) {
        const itemKey = createPinterestResultKey(item);
        if (!itemKey) {
            repeated.push(item);
            continue;
        }

        if (recentSet.has(itemKey)) {
            repeated.push(item);
        } else {
            fresh.push(item);
        }
    }

    const selected = [...fresh, ...repeated].slice(0, requestedLimit);
    rememberPinterestResults(query, selected);
    return selected;
}

function sanitizeFileName(text, fallback = 'audio') {
    const normalized = String(text || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const safe = normalized
        .replace(/[\\/:*?"<>|\x00-\x1F]/g, ' ')
        .replace(/[^\w\-. ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[. ]+$/g, '')
        .trim();

    const limited = safe.slice(0, 100).trim();
    return limited || fallback;
}

function resolvePublishedDate(entry) {
    const uploadDate = String(entry?.upload_date || '').trim();
    if (/^\d{8}$/.test(uploadDate)) {
        return `${uploadDate.slice(6, 8)}/${uploadDate.slice(4, 6)}/${uploadDate.slice(0, 4)}`;
    }

    const timestamp = Number(entry?.timestamp || 0);
    if (Number.isFinite(timestamp) && timestamp > 0) {
        const publishedAt = new Date(timestamp * 1000);
        if (!Number.isNaN(publishedAt.getTime())) {
            return publishedAt.toLocaleDateString('es-ES');
        }
    }

    return 'Desconocida';
}

function resolveVideoSizeMb(entry) {
    const bytes = Number(entry?.filesize || entry?.filesize_approx || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return 'Desconocido';
    }

    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
}

async function buildUniqueFilePath(dirPath, baseName, extension) {
    let candidate = path.join(dirPath, `${baseName}${extension}`);
    let counter = 1;

    while (true) {
        try {
            await fs.access(candidate);
            candidate = path.join(dirPath, `${baseName} (${counter})${extension}`);
            counter += 1;
        } catch {
            return candidate;
        }
    }
}

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

async function getYtDlpInfoSafe(input) {
    const target = String(input || '').trim();
    if (!target) {
        return null;
    }

    // Check cache first
    const cacheEntry = videoInfoCache.get(target);
    if (cacheEntry && cacheEntry.expiresAt > Date.now()) {
        return cacheEntry.data;
    }

    let result = null;
    try {
        result = await ytDlp.getVideoInfo(target);
    } catch {
        // For image-only Pinterest pins, --dump-single-json works better than getVideoInfo().
    }

    if (!result) {
        try {
            const raw = await ytDlp.execPromise([
                target,
                '--dump-single-json',
                '--skip-download',
                '--no-warnings'
            ]);

            result = JSON.parse(String(raw || '{}'));
        } catch {
            return null;
        }
    }

    // Store in cache with TTL
    if (result) {
        videoInfoCache.set(target, {
            data: result,
            expiresAt: Date.now() + performance.videoInfoCacheTtlSeconds * 1000
        });
    }

    return result;
}

async function findDownloadedFile(prefix, preferredExtensions = []) {
    const entries = await fs.readdir(paths.tempDir);
    const matchedEntries = entries.filter((name) => name.startsWith(prefix));

    const fallbackExtensions = ['.mp4', '.webm', '.mkv', '.mov', '.m4v', '.avi'];
    const validExtensions = Array.isArray(preferredExtensions) && preferredExtensions.length > 0
        ? preferredExtensions
        : fallbackExtensions;

    const match = matchedEntries.find((name) => {
        const extension = path.extname(name).toLowerCase();
        return validExtensions.includes(extension);
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
        await execFFmpeg(args, {
            maxBufferBytes: performance.ffmpegMaxBufferMb * 1024 * 1024,
            timeoutMs: performance.ffmpegTimeoutMs
        });
    } catch (error) {
        const ffmpegError = String(error?.stderr || error?.message || error || 'FFMPEG_CONVERSION_FAILED').trim();
        throw new Error(`FFMPEG_CONVERSION_FAILED: ${ffmpegError}`);
    } finally {
        await safeCleanup(inputPath);
    }

    return outputPath;
}

async function convertToMp3(inputPath, prefix) {
    if (!ffmpegPath) {
        throw new Error('FFMPEG_NOT_AVAILABLE');
    }

    const outputPath = path.join(paths.tempDir, `${prefix}-audio.mp3`);
    await safeCleanup(outputPath);

    const args = [
        '-y',
        '-i',
        inputPath,
        '-vn',
        '-c:a',
        'libmp3lame',
        '-q:a',
        '2',
        outputPath
    ];

    try {
        await execFFmpeg(args, {
            maxBufferBytes: performance.ffmpegMaxBufferMb * 1024 * 1024,
            timeoutMs: performance.ffmpegTimeoutMs
        });
    } catch (error) {
        const ffmpegError = String(error?.stderr || error?.message || error || 'FFMPEG_CONVERSION_FAILED').trim();
        throw new Error(`FFMPEG_CONVERSION_FAILED: ${ffmpegError}`);
    } finally {
        await safeCleanup(inputPath);
    }

    return outputPath;
}

async function downloadThumbnailToTemp(thumbnailUrl, prefix) {
    const sourceUrl = String(thumbnailUrl || '').trim();
    if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
        return null;
    }

    const response = await fetch(sourceUrl, {
        headers: {
            'user-agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            accept: 'image/*,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
        return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || '';
    const extensionFromType = inferExtensionFromContentType(contentType);
    const extensionFromUrl = path.extname(sourceUrl.split('?')[0] || '').toLowerCase();
    const extension = extensionFromType || extensionFromUrl || '.jpg';

    const tempThumbnailPath = await buildUniqueFilePath(paths.tempDir, `${prefix}-thumb`, extension);
    await fs.writeFile(tempThumbnailPath, buffer);

    const isNativeCoverFormat = ['.jpg', '.jpeg', '.png'].includes(path.extname(tempThumbnailPath).toLowerCase());
    if (isNativeCoverFormat) {
        return tempThumbnailPath;
    }

    return convertImageToJpg(tempThumbnailPath, `${prefix}-thumb`);
}

async function embedMp3CoverArt(audioPath, thumbnailUrl, prefix) {
    if (!audioPath || !thumbnailUrl || !ffmpegPath) {
        return audioPath;
    }

    let thumbnailPath = null;
    const outputPath = path.join(paths.tempDir, `${prefix}-audio-cover.mp3`);
    await safeCleanup(outputPath);

    try {
        thumbnailPath = await downloadThumbnailToTemp(thumbnailUrl, prefix);
        if (!thumbnailPath) {
            return audioPath;
        }

        const args = [
            '-y',
            '-i',
            audioPath,
            '-i',
            thumbnailPath,
            '-map',
            '0:a',
            '-map',
            '1:v',
            '-c:a',
            'copy',
            '-c:v',
            'mjpeg',
            '-disposition:v',
            'attached_pic',
            '-id3v2_version',
            '3',
            '-metadata:s:v',
            'title=Cover',
            '-metadata:s:v',
            'comment=Cover (front)',
            outputPath
        ];

        try {
            await execFFmpeg(args, {
                maxBufferBytes: performance.ffmpegMaxBufferMb * 1024 * 1024,
                timeoutMs: performance.ffmpegTimeoutMs
            });
        } catch (error) {
            // if embedding fails, preserve original audio
            await safeCleanup(outputPath);
            return audioPath;
        }

        await safeCleanup(audioPath);
        return outputPath;
    } catch {
        await safeCleanup(outputPath);
        return audioPath;
    } finally {
        await safeCleanup(thumbnailPath);
    }
}

async function convertImageToJpg(inputPath, prefix) {
    if (!ffmpegPath) {
        throw new Error('FFMPEG_NOT_AVAILABLE');
    }

    const outputPath = path.join(paths.tempDir, `${prefix}-image.jpg`);
    await safeCleanup(outputPath);

    const args = [
        '-y',
        '-i',
        inputPath,
        '-frames:v',
        '1',
        '-q:v',
        '2',
        outputPath
    ];

    try {
        await execFFmpeg(args, {
            maxBufferBytes: performance.ffmpegMaxBufferMb * 1024 * 1024,
            timeoutMs: performance.ffmpegTimeoutMs
        });
    } catch (error) {
        const ffmpegError = String(error?.stderr || error?.message || error || 'FFMPEG_CONVERSION_FAILED').trim();
        throw new Error(`FFMPEG_CONVERSION_FAILED: ${ffmpegError}`);
    } finally {
        await safeCleanup(inputPath);
    }

    return outputPath;
}

function normalizePinterestMediaUrl(url) {
    const raw = String(url || '').trim();
    if (!raw || !/^https?:\/\//i.test(raw)) {
        return null;
    }

    // Remove transient query params to improve dedupe and stable file extensions.
    return raw.split('?')[0];
}

function resolvePinterestMediaType(mediaUrl) {
    const extension = path.extname(String(mediaUrl || '').toLowerCase());
    if (['.mp4', '.webm', '.mkv', '.mov', '.m4v', '.avi', '.gif'].includes(extension)) {
        return 'video';
    }

    return 'image';
}

function normalizePinterestTitle(rawTitle, fallback = 'Pinterest') {
    const base = String(rawTitle || '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!base) {
        return fallback;
    }

    // Pinterest often returns keyword-style titles with many commas.
    const parts = base.split(',').map((part) => part.trim()).filter(Boolean);
    let cleaned = base;

    if (parts.length >= 3) {
        cleaned = parts[0];
    }

    cleaned = cleaned
        .replace(/^Image\s*\d+\s*:\s*/i, '')
        .replace(/^[-:|]+\s*/, '')
        .trim();

    if (!cleaned || cleaned.length < 3) {
        return fallback;
    }

    return cleaned.slice(0, 80).trim();
}

function buildPinterestSearchResultsFromMetadata(query, metadata, maxItems) {
    const sourceEntries = Array.isArray(metadata?.entries)
        ? metadata.entries
        : metadata
            ? [metadata]
            : [];

    const seen = new Set();
    const results = [];

    for (const entry of sourceEntries) {
        if (!entry) continue;

        const sourceUrl =
            entry.webpage_url ||
            entry.original_url ||
            entry.url ||
            null;

        const thumbnailFromArray = Array.isArray(entry.thumbnails)
            ? entry.thumbnails.map((item) => item?.url).find(Boolean)
            : null;

        const mediaUrl = normalizePinterestMediaUrl(
            entry.thumbnail ||
            thumbnailFromArray ||
            entry.url
        );

        if (!mediaUrl || !sourceUrl) continue;

        const key = `${sourceUrl}|${mediaUrl}`;
        if (seen.has(key)) continue;
        seen.add(key);

        results.push({
            title: String(entry.title || `${query} ${results.length + 1}`).trim(),
            sourceUrl,
            mediaUrl,
            mediaType: resolvePinterestMediaType(mediaUrl)
        });

        if (results.length >= maxItems) {
            break;
        }
    }

    return results;
}

function buildPinterestFallbackResultsFromHtml(query, searchUrl, html, maxItems) {
    const imageRegex = /https:\/\/i\.pinimg\.com\/[^"'\s)]+\.(?:jpe?g|png|webp)(?:\?[^"'\s)]*)?/gi;
    const rawMatches = String(html || '').match(imageRegex) || [];

    const unique = [];
    const seen = new Set();
    for (const rawUrl of rawMatches) {
        const mediaUrl = normalizePinterestMediaUrl(rawUrl);
        if (!mediaUrl || seen.has(mediaUrl)) continue;
        seen.add(mediaUrl);
        unique.push(mediaUrl);
        if (unique.length >= maxItems) {
            break;
        }
    }

    return unique.map((mediaUrl, index) => ({
        title: `${query} ${index + 1}`,
        sourceUrl: searchUrl,
        mediaUrl,
        mediaType: 'image'
    }));
}

function parseDuckDuckGoRedirect(rawUrl) {
    const value = String(rawUrl || '');
    const marker = 'uddg=';
    const markerIndex = value.indexOf(marker);
    if (markerIndex === -1) {
        return null;
    }

    const encoded = value.slice(markerIndex + marker.length).split('&')[0];
    if (!encoded) {
        return null;
    }

    try {
        return decodeURIComponent(encoded);
    } catch {
        return null;
    }
}

function normalizePinterestPinUrl(url) {
    const value = String(url || '').trim();
    if (!value) {
        return null;
    }

    try {
        const parsed = new URL(value);
        const host = parsed.hostname.toLowerCase();
        if (!host.endsWith('pinterest.com')) {
            return null;
        }

        const pinMatch = parsed.pathname.match(/^\/pin\/(?:[^/]*?--)?([0-9]+)\/?/);
        if (!pinMatch) {
            return null;
        }

        return `https://www.pinterest.com/pin/${pinMatch[1]}/`;
    } catch {
        return null;
    }
}

async function searchPinterestPinUrlsByDuckDuckGo(query, maxItems) {
    const searchQuery = `site:pinterest.com/pin ${query}`;
    const offsets = [0, 30, 60, 90];
    const found = [];
    const seen = new Set();

    for (const offset of offsets) {
        if (found.length >= maxItems) {
            break;
        }

        const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}&s=${offset}`;
        let html = '';

        try {
            const response = await fetch(searchUrl, {
                headers: {
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    accept: 'text/html,application/xhtml+xml'
                },
                signal: AbortSignal.timeout(20000)
            });

            if (!response.ok) {
                continue;
            }

            html = await response.text();
        } catch {
            continue;
        }

        const rawCandidates = [
            ...[...String(html).matchAll(/uddg=([^&"'\s<>]+)/gi)].map((item) => decodeURIComponent(item[1])),
            ...[...String(html).matchAll(/https?:\/\/[^"'\s<>]+/gi)].map((item) => item[0])
        ];

        for (const rawLink of rawCandidates) {
            const decoded = parseDuckDuckGoRedirect(rawLink) || rawLink;
            const normalizedPinUrl = normalizePinterestPinUrl(decoded);
            if (!normalizedPinUrl) {
                continue;
            }

            if (seen.has(normalizedPinUrl)) {
                continue;
            }

            seen.add(normalizedPinUrl);
            found.push(normalizedPinUrl);

            if (found.length >= maxItems) {
                break;
            }
        }
    }

    return found;
}

function extractPinterestCandidatesFromText(text, maxItems) {
    const rawText = String(text || '');
    const structuredMatches = [...rawText.matchAll(/\[!\[Image\s+\d+:\s*([^\]]+)\]\((https?:\/\/i\.pinimg\.com\/[^)\s]+)\)\]\((https?:\/\/(?:www\.|[a-z]{2}\.)?pinterest\.com\/pin\/[^)\s]+)\)/gi)];

    const structuredCandidates = [];
    const structuredSeen = new Set();
    for (const match of structuredMatches) {
        const title = normalizePinterestTitle(match[1], null);
        const mediaUrl = normalizePinterestMediaUrl(match[2]);
        const sourceUrl = normalizePinterestPinUrl(match[3]);
        if (!sourceUrl || !mediaUrl) {
            continue;
        }

        const key = `${sourceUrl}|${mediaUrl}`;
        if (structuredSeen.has(key)) {
            continue;
        }

        structuredSeen.add(key);
        structuredCandidates.push({
            sourceUrl,
            mediaUrl,
            title: title || null
        });

        if (structuredCandidates.length >= maxItems) {
            return structuredCandidates;
        }
    }

    const pinUrls = [...new Set(
        (rawText.match(/https?:\/\/(?:www\.|[a-z]{2}\.)?pinterest\.com\/pin\/[^\s"')]+/gi) || [])
            .map((url) => normalizePinterestPinUrl(url))
            .filter(Boolean)
    )];

    const mediaUrls = [...new Set(
        (rawText.match(/https?:\/\/i\.pinimg\.com\/[^\s"')]+/gi) || [])
            .map((url) => normalizePinterestMediaUrl(url))
            .filter(Boolean)
    )];

    const limit = Math.max(1, maxItems);
    const candidates = [];
    for (let index = 0; index < pinUrls.length && candidates.length < limit; index += 1) {
        candidates.push({
            sourceUrl: pinUrls[index],
            mediaUrl: mediaUrls[index] || null,
            title: null
        });
    }

    return candidates;
}

async function searchPinterestCandidatesByJina(query, maxItems) {
    const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
    const proxyUrl = `https://r.jina.ai/http://${searchUrl.replace(/^https?:\/\//, '')}`;

    try {
        const response = await fetch(proxyUrl, {
            headers: {
                'user-agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                accept: 'text/plain, text/markdown'
            },
            signal: AbortSignal.timeout(25000)
        });

        if (!response.ok) {
            return [];
        }

        const content = await response.text();
        return extractPinterestCandidatesFromText(content, maxItems);
    } catch {
        return [];
    }
}

function inferExtensionFromContentType(contentType) {
    const value = String(contentType || '').toLowerCase();
    if (value.includes('jpeg') || value.includes('jpg')) return '.jpg';
    if (value.includes('png')) return '.png';
    if (value.includes('webp')) return '.webp';
    if (value.includes('gif')) return '.gif';
    if (value.includes('mp4')) return '.mp4';
    if (value.includes('webm')) return '.webm';
    if (value.includes('quicktime')) return '.mov';
    return '';
}

async function saveRemoteMediaToTemp(url, prefix, preferredTitle = 'pinterest') {
    const response = await fetch(url, {
        headers: {
            'user-agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            accept: '*/*'
        },
        signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
        throw new Error(`No se pudo descargar media de Pinterest (${response.status}).`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || '';
    const extensionFromType = inferExtensionFromContentType(contentType);
    const extensionFromUrl = path.extname(normalizePinterestMediaUrl(url) || '').toLowerCase();
    const extension = extensionFromType || extensionFromUrl || '.jpg';

    const safeBaseName = sanitizeFileName(preferredTitle, 'pinterest');
    const outputPath = await buildUniqueFilePath(paths.tempDir, `${prefix}-${safeBaseName}`, extension);
    await fs.writeFile(outputPath, buffer);
    return outputPath;
}

async function normalizePinterestDownloadForWhatsApp(inputPath, prefix) {
    const extension = path.extname(String(inputPath || '').toLowerCase());
    const isVideo = ['.mp4', '.webm', '.mkv', '.mov', '.m4v', '.avi', '.gif'].includes(extension);

    if (isVideo) {
        const outputPath = await convertToWhatsAppVideo(inputPath, prefix);
        return { filePath: outputPath, mediaType: 'video' };
    }

    const isNativeCompatibleImage = ['.jpg', '.jpeg', '.png'].includes(extension);
    if (isNativeCompatibleImage) {
        return { filePath: inputPath, mediaType: 'image' };
    }

    const convertedImage = await convertImageToJpg(inputPath, prefix);
    return { filePath: convertedImage, mediaType: 'image' };
}

async function searchPinterestMedia(query, limit = 3) {
    const searchQuery = String(query || '').trim();
    if (!searchQuery) {
        throw new Error('Debes indicar un termino para Pinterest.');
    }

    const safeLimit = Math.max(1, Math.min(15, Number(limit) || 3));
    const poolSize = Math.max(20, safeLimit * 6);

    const [preferredCandidates, fallbackPinUrls] = await Promise.all([
        searchPinterestCandidatesByJina(searchQuery, poolSize),
        searchPinterestPinUrlsByDuckDuckGo(searchQuery, poolSize)
    ]);

    // Merge sources to avoid being stuck with the same first Pinterest rows.
    const mergedCandidates = [
        ...preferredCandidates,
        ...fallbackPinUrls.map((pinUrl) => ({
            sourceUrl: pinUrl,
            mediaUrl: null,
            title: null
        }))
    ];

    const uniqueCandidates = [];
    const seenSourceUrls = new Set();
    for (const item of mergedCandidates) {
        const sourceUrl = String(item?.sourceUrl || '').trim();
        if (!sourceUrl || seenSourceUrls.has(sourceUrl)) {
            continue;
        }

        seenSourceUrls.add(sourceUrl);
        uniqueCandidates.push(item);
    }

    const baseResults = [];
    const seenMediaUrls = new Set();

    for (const candidate of shuffleArray(uniqueCandidates)) {
        if (baseResults.length >= poolSize) {
            break;
        }

        const pinUrl = String(candidate?.sourceUrl || '').trim();
        if (!pinUrl) {
            continue;
        }

        let mediaUrl = normalizePinterestMediaUrl(candidate?.mediaUrl);
        let resolvedTitle = normalizePinterestTitle(candidate?.title, `${searchQuery} ${baseResults.length + 1}`);

        if (!mediaUrl) {
            const metadata = await getYtDlpInfoSafe(pinUrl);
            const thumbnailFromArray = Array.isArray(metadata?.thumbnails)
                ? metadata.thumbnails.map((item) => item?.url).find(Boolean)
                : null;

            mediaUrl = normalizePinterestMediaUrl(metadata?.thumbnail || thumbnailFromArray);
            resolvedTitle = normalizePinterestTitle(metadata?.title || resolvedTitle, resolvedTitle);
        }

        if (!mediaUrl || seenMediaUrls.has(mediaUrl)) {
            continue;
        }

        seenMediaUrls.add(mediaUrl);
        baseResults.push({
            title: resolvedTitle,
            sourceUrl: pinUrl,
            mediaUrl,
            mediaType: 'image'
        });
    }

    return pickPinterestResults(searchQuery, baseResults, safeLimit);
}

async function downloadPinterestMedia(url, preferredTitle = 'Pinterest') {
    await ensureTempDir();

    const sourceUrl = String(url || '').trim();
    if (!sourceUrl) {
        throw new Error('Debes indicar una URL de Pinterest.');
    }

    const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const outputTemplate = path.join(paths.tempDir, `${id}.%(ext)s`);

    const metadata = await getYtDlpInfoSafe(sourceUrl);

    let downloadedPath = null;

    try {
        await ytDlp.execPromise([
            sourceUrl,
            '-o',
            outputTemplate,
            '--no-playlist',
            '--no-warnings',
            '--no-check-certificates',
            '--retries',
            '2',
            '--max-filesize',
            `${limits.maxFileSizeMb}M`
        ]);

        downloadedPath = await findDownloadedFile(id, [
            '.mp4',
            '.webm',
            '.mkv',
            '.mov',
            '.m4v',
            '.avi',
            '.gif',
            '.jpg',
            '.jpeg',
            '.png',
            '.webp'
        ]);
    } catch {
        const thumbnailUrl = normalizePinterestMediaUrl(
            metadata?.thumbnail ||
            (Array.isArray(metadata?.thumbnails) ? metadata.thumbnails.map((item) => item?.url).find(Boolean) : null) ||
            sourceUrl
        );

        if (!thumbnailUrl) {
            throw new Error('No se pudo descargar el contenido de Pinterest.');
        }

        downloadedPath = await saveRemoteMediaToTemp(thumbnailUrl, id, preferredTitle);
    }

    const normalized = await normalizePinterestDownloadForWhatsApp(downloadedPath, id);
    const stats = await fs.stat(normalized.filePath);
    if (stats.size > limits.maxFileSizeBytes) {
        await safeCleanup(normalized.filePath);
        throw new Error(`El archivo supera el limite de ${limits.maxFileSizeMb}MB.`);
    }

    const title = normalizePinterestTitle(
        metadata?.title || preferredTitle,
        sanitizeFileName(preferredTitle, 'Pinterest media')
    );

    return {
        filePath: normalized.filePath,
        title,
        mediaType: normalized.mediaType,
        sourceUrl
    };
}

async function downloadPinterestSearchItem(item) {
    const entry = item || {};
    const sourceUrl = String(entry.sourceUrl || '').trim();
    const mediaUrl = String(entry.mediaUrl || '').trim();
    const title = normalizePinterestTitle(entry.title, 'Pinterest');

    if (!mediaUrl) {
        if (!sourceUrl) {
            throw new Error('Resultado de Pinterest sin URL de media.');
        }

        return downloadPinterestMedia(sourceUrl, title);
    }

    const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    const rawPath = await saveRemoteMediaToTemp(mediaUrl, id, title);
    const normalized = await normalizePinterestDownloadForWhatsApp(rawPath, id);

    const stats = await fs.stat(normalized.filePath);
    if (stats.size > limits.maxFileSizeBytes) {
        await safeCleanup(normalized.filePath);
        throw new Error(`El archivo supera el limite de ${limits.maxFileSizeMb}MB.`);
    }

    return {
        filePath: normalized.filePath,
        title,
        mediaType: normalized.mediaType,
        sourceUrl,
        mediaUrl
    };
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
        String(performance.downloadConcurrentFragments),
        '--retries',
        String(performance.downloadRetries),
        '--fragment-retries',
        String(performance.downloadRetries),
        '--socket-timeout',
        '30',
        '--skip-unavailable-fragments',
        '--max-filesize',
        `${limits.maxFileSizeMb}M`
    ];

    // Add speed limit if configured
    if (performance.downloadSpeedLimit > 0) {
        baseArgs.push('--limit-rate', `${Math.floor(performance.downloadSpeedLimit / 1024)}k`);
    }

    const formatCandidates = [
        'best[height<=720][ext=mp4][vcodec!=none][acodec!=none]/best[height<=720][ext=mp4]/best[height<=720][vcodec!=none][acodec!=none]/best[height<=720]',
        'best[ext=mp4]/best'
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

    const downloadedPath = await findDownloadedFile(id, ['.mp4', '.webm', '.mkv', '.mov', '.m4v', '.avi']);
    const filePath = await convertToWhatsAppVideo(downloadedPath, id);
    const stats = await fs.stat(filePath);

    if (stats.size > limits.maxFileSizeBytes) {
        await safeCleanup(filePath);
        throw new Error(`El archivo supera el límite de ${limits.maxFileSizeMb}MB.`);
    }

    const title = metadata?.title || 'Video descargado';
    return { filePath, title };
}

async function searchVideosByTitle(query, limit = 3) {
    const searchQuery = String(query || '').trim();
    if (!searchQuery) {
        throw new Error('Debes indicar un titulo para buscar.');
    }

    const safeLimit = Math.max(1, Math.min(10, Number(limit) || 3));
    const searchInput = `ytsearch${safeLimit}:${searchQuery}`;

    let results = [];

    try {
        const metadata = await ytDlp.getVideoInfo(searchInput);
        const rawEntries = Array.isArray(metadata?.entries)
            ? metadata.entries
            : metadata
                ? [metadata]
                : [];

        results = rawEntries
            .filter((entry) => entry && (entry.webpage_url || entry.url))
            .slice(0, safeLimit)
            .map((entry) => ({
                title: entry.title || 'Sin titulo',
                author: entry.uploader || entry.channel || entry.creator || 'Desconocido',
                publishedAt: resolvePublishedDate(entry),
                sizeMb: resolveVideoSizeMb(entry),
                sourceUrl: entry.webpage_url || entry.url
            }));
    } catch {
        results = [];
    }

    if (results.length > 0) {
        return results;
    }

    // Fallback: parse one JSON object per line from yt-dlp search output.
    const rawJsonLines = await ytDlp.execPromise([
        searchInput,
        '--skip-download',
        '--dump-json',
        '--no-warnings',
        '--no-playlist'
    ]);

    const parsedResults = String(rawJsonLines || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            try {
                const item = JSON.parse(line);
                return {
                    title: item?.title || 'Sin titulo',
                    author: item?.uploader || item?.channel || item?.creator || 'Desconocido',
                    publishedAt: resolvePublishedDate(item),
                    sizeMb: resolveVideoSizeMb(item),
                    sourceUrl: item?.webpage_url || item?.url || null
                };
            } catch {
                return null;
            }
        })
        .filter((item) => item && item.sourceUrl)
        .slice(0, safeLimit);

    return parsedResults;
}

async function downloadVideoBySearch(query) {
    const searchQuery = String(query || '').trim();
    if (!searchQuery) {
        throw new Error('Debes indicar un titulo para buscar.');
    }

    await ensureTempDir();

    const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const outputTemplate = path.join(paths.tempDir, `${id}.%(ext)s`);
    const searchInput = `ytsearch1:${searchQuery}`;

    let metadata = null;
    try {
        metadata = await ytDlp.getVideoInfo(searchInput);
    } catch {
        metadata = null;
    }

    const baseArgs = [
        searchInput,
        '-o',
        outputTemplate,
        '--no-playlist',
        '--no-warnings',
        '--no-check-certificates',
        '--concurrent-fragments',
        String(performance.downloadConcurrentFragments),
        '--retries',
        String(performance.downloadRetries),
        '--fragment-retries',
        String(performance.downloadRetries),
        '--socket-timeout',
        '30',
        '--skip-unavailable-fragments',
        '--max-filesize',
        `${limits.maxFileSizeMb}M`
    ];

    // Add speed limit if configured
    if (performance.downloadSpeedLimit > 0) {
        baseArgs.push('--limit-rate', `${Math.floor(performance.downloadSpeedLimit / 1024)}k`);
    }

    const formatCandidates = [
        'best[height<=720][ext=mp4][vcodec!=none][acodec!=none]/best[height<=720][ext=mp4]/best[height<=720][vcodec!=none][acodec!=none]/best[height<=720]',
        'best[ext=mp4]/best'
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

    const downloadedPath = await findDownloadedFile(id, ['.mp4', '.webm', '.mkv', '.mov', '.m4v', '.avi']);
    const filePath = await convertToWhatsAppVideo(downloadedPath, id);
    const stats = await fs.stat(filePath);

    if (stats.size > limits.maxFileSizeBytes) {
        await safeCleanup(filePath);
        throw new Error(`El archivo supera el limite de ${limits.maxFileSizeMb}MB.`);
    }

    const bestEntry = Array.isArray(metadata?.entries) ? metadata.entries[0] : null;
    const title =
        metadata?.title ||
        bestEntry?.title ||
        `Resultado de busqueda: ${searchQuery}`;
    const sourceUrl =
        metadata?.webpage_url ||
        bestEntry?.webpage_url ||
        bestEntry?.url ||
        null;

    return { filePath, title, sourceUrl };
}

async function downloadAudio(url) {
    await ensureTempDir();

    const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const outputTemplate = path.join(paths.tempDir, `${id}.%(ext)s`);

    let metadata = null;
    try {
        metadata = await ytDlp.getVideoInfo(url);
    } catch {
        metadata = null;
    }

    const args = [
        url,
        '-o',
        outputTemplate,
        '--no-playlist',
        '--no-warnings',
        '--no-check-certificates',
        '--extract-audio',
        '--audio-format',
        'mp3',
        '--audio-quality',
        '192',
        '--retries',
        String(performance.downloadRetries),
        '--fragment-retries',
        String(performance.downloadRetries),
        '--socket-timeout',
        '30',
        '--concurrent-fragments',
        String(performance.downloadConcurrentFragments),
        '-f',
        'bestaudio/best',
        '--max-filesize',
        `${limits.maxFileSizeMb}M`
    ];

    // Add speed limit if configured
    if (performance.downloadSpeedLimit > 0) {
        args.push('--limit-rate', `${Math.floor(performance.downloadSpeedLimit / 1024)}k`);
    }

    await ytDlp.execPromise(args);

    const sourcePath = await findDownloadedFile(id, ['.mp3', '.m4a', '.aac', '.opus', '.wav', '.ogg', '.webm', '.mp4']);
    const initialPath = await convertToMp3(sourcePath, id);
    const thumbnailUrl =
        metadata?.thumbnail ||
        (Array.isArray(metadata?.thumbnails) ? metadata.thumbnails.map((item) => item?.url).find(Boolean) : null);
    const pathWithCover = await embedMp3CoverArt(initialPath, thumbnailUrl, id);
    const stats = await fs.stat(pathWithCover);

    if (stats.size > limits.maxFileSizeBytes) {
        await safeCleanup(pathWithCover);
        throw new Error(`El archivo supera el limite de ${limits.maxFileSizeMb}MB.`);
    }

    const title = metadata?.title || 'Audio descargado';
    const safeBaseName = sanitizeFileName(title, 'audio');
    const renamedPath = await buildUniqueFilePath(paths.tempDir, safeBaseName, '.mp3');

    await fs.rename(pathWithCover, renamedPath);

    const audioFileName = path.basename(renamedPath);
    return { filePath: renamedPath, title, audioFileName };
}

module.exports = {
    ensureYtDlpBinary,
    downloadVideo,
    searchVideosByTitle,
    downloadVideoBySearch,
    downloadAudio,
    searchPinterestMedia,
    downloadPinterestMedia,
    downloadPinterestSearchItem,
    safeCleanup
};
