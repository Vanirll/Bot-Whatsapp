const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { PINTEREST_COOKIES } = require('../constants/bot');

async function parseCookieString(cookieString) {
    if (!cookieString) return [];
    return cookieString.split(';').map((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return null;
        const name = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (!name) return null;
        return { name, value, domain: '.pinterest.com', path: '/' };
    }).filter(Boolean);
}

function resolveEdgeExecutablePath() {
    const candidates = [
        process.env.EDGE_EXECUTABLE_PATH,
        process.env.EDGE_PATH,
        process.env.PUPPETEER_EXECUTABLE_PATH,
        process.env.CHROME_PATH,
        process.env.PROGRAMFILES ? path.join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
        process.env['PROGRAMFILES(X86)'] ? path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null
    ].filter(Boolean);

    for (const candidate of candidates) {
        try {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        } catch {
            // ignore and continue searching
        }
    }

    if (process.platform === 'win32') {
        try {
            const whereOutput = execFileSync('cmd', ['/c', 'where msedge'], {
                encoding: 'utf8',
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'ignore']
            });

            const resolvedFromWhere = String(whereOutput || '')
                .split(/\r?\n/)
                .map((line) => line.trim())
                .find(Boolean);

            if (resolvedFromWhere && fs.existsSync(resolvedFromWhere)) {
                return resolvedFromWhere;
            }
        } catch {
            // ignore and fall through
        }
    }

    return null;
}

async function searchPinterestWithPuppeteer(query, maxItems = 6) {
    try {
        const puppeteer = require('puppeteer-core');
        const executablePath = resolveEdgeExecutablePath();

        if (!executablePath) {
            throw new Error('No se encontró Microsoft Edge. Define EDGE_EXECUTABLE_PATH o instala Edge.');
        }

        const browser = await puppeteer.launch({
            headless: true,
            executablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-features=IsolateOrigins,site-per-process']
        });

        const page = await browser.newPage();
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        );

        const cookies = await parseCookieString(PINTEREST_COOKIES);
        if (cookies.length > 0) {
            try { await page.setCookie(...cookies); } catch (_) {}
        }

        const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 20000 });

        // Scroll a bit to load images
        await page.evaluate(async () => {
            const distance = 800;
            const delay = (ms) => new Promise((r) => setTimeout(r, ms));
            for (let i = 0; i < 3; i++) {
                window.scrollBy(0, distance);
                // allow lazy images to load
                // eslint-disable-next-line no-await-in-loop
                await delay(600);
            }
        });

        const results = await page.evaluate((limit) => {
            const items = [];
            const anchors = Array.from(document.querySelectorAll('a[href*="/pin/"]'));
            const seen = new Set();
            for (const a of anchors) {
                try {
                    const href = a.href || a.getAttribute('href');
                    if (!href) continue;
                    const pinMatch = href.match(/https?:\/\/[^/]+\/pin\/(\d+)/i);
                    if (!pinMatch) continue;
                    const sourceUrl = href.split('?')[0];
                    if (seen.has(sourceUrl)) continue;
                    seen.add(sourceUrl);

                    // find image inside anchor
                    let img = a.querySelector('img');
                    let mediaUrl = img ? (img.currentSrc || img.src || img.getAttribute('data-src')) : null;
                    if (!mediaUrl) {
                        // try descendants
                        const img2 = a.querySelector('[style*="background-image"]');
                        if (img2) {
                            const m = img2.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
                            mediaUrl = m ? m[1] : null;
                        }
                    }

                    const title = a.getAttribute('aria-label') || (img && img.alt) || null;
                    items.push({ sourceUrl, mediaUrl, title });
                    if (items.length >= limit) break;
                } catch (e) {
                    // ignore
                }
            }
            return items;
        }, Math.max(1, Math.min(15, maxItems)));

        await browser.close();
        return results || [];
    } catch (error) {
        // Puppeteer not installed or runtime error
        console.warn('[Pinterest Puppeteer] No está disponible o falló:', error?.message || error);
        return [];
    }
}

module.exports = { searchPinterestWithPuppeteer };
