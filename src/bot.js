const qrcode = require('qrcode-terminal');
const { once } = require('node:events');
const { Client, LocalAuth } = require('whatsapp-web.js');

const { paths } = require('./config');
const { ensureYtDlpBinary } = require('./services/downloader');
const { registerMessageHandler } = require('./handlers/messageHandler');
const { acquireProcessLock, releaseProcessLock } = require('./utils/processLock');
const { ytDlp } = require('./services/downloader');

const puppeteerArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-default-apps',
    '--no-first-run',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--metrics-recording-only',
    '--mute-audio'
];

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: paths.sessionPath }),
    puppeteer: {
        headless: true,
        args: puppeteerArgs
    }
});

client.on('qr', (qr) => {
    console.log('\nEscanea este QR con WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('loading_screen', (percent, message) => {
    process.stdout.write(`\r⏳ Cargando WhatsApp: ${percent}% - ${message}   `);
});

client.on('authenticated', () => {
    console.log('\n✅ Sesión autenticada');
});

client.on('ready', () => {
    console.log('\n✅ Bot listo. Usa .menu/#menu para ayuda y .ds/#ds para descargar.');
});

client.on('auth_failure', (msg) => {
    console.error('Error de autenticación:', msg);
});

client.on('disconnected', (reason) => {
    console.log('Bot desconectado:', reason);
});

registerMessageHandler(client);

let isShuttingDown = false;

async function startBot() {
    try {
        await acquireProcessLock();
        await ensureYtDlpBinary();

        console.log("yt-dlp:", paths.ytDlpBinary);


        console.log('Iniciando cliente de WhatsApp...');

        const readyPromise = once(client, 'ready');
        const initPromise = client.initialize();
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('READY_TIMEOUT')), 120_000)
        );

        await Promise.race([
            initPromise.then(() => readyPromise),
            readyPromise,
            timeoutPromise,
        ]);
    } catch (err) {
        const message = String(err?.message || '');

        if (message.startsWith('BOT_ALREADY_RUNNING:')) {
            const pid = String(err.message).split(':')[1] || 'desconocido';
            console.error(`Ya hay otra instancia del bot ejecutándose (PID ${pid}). Cierra la anterior para ahorrar RAM.`);
            process.exit(1);
        }

        if (message === 'READY_TIMEOUT') {
            console.error('El cliente de WhatsApp no llegó al estado ready dentro del tiempo esperado. Revisa si el navegador quedó bloqueado o si la sesión está corrupta.');
        }

        console.error('No se pudo iniciar el bot:', err);
        await releaseProcessLock();
        process.exit(1);
    }
}

async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    const isWindowsSigint = process.platform === 'win32' && signal === 'SIGINT';

    if (!isWindowsSigint) {
        try {
            await client.destroy();
        } catch {
            // ignore shutdown errors
        }
    }

    await releaseProcessLock();
    process.exitCode = 0;
}

process.on('SIGINT', () => {
    void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});

module.exports = {
    startBot
};
