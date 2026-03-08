const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const { paths } = require('./config');
const { ensureYtDlpBinary } = require('./services/downloader');
const { registerMessageHandler } = require('./handlers/messageHandler');
const { acquireProcessLock, releaseProcessLock } = require('./utils/processLock');

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

client.on('ready', () => {
    console.log('Bot listo. Usa .menu/#menu para ayuda y .ds/#ds para descargar.');
});

client.on('auth_failure', (msg) => {
    console.error('Error de autenticación:', msg);
});

client.on('disconnected', (reason) => {
    console.log('Bot desconectado:', reason);
});

registerMessageHandler(client);

async function startBot() {
    try {
        await acquireProcessLock();
        await ensureYtDlpBinary();
        await client.initialize();
    } catch (err) {
        if (String(err?.message || '').startsWith('BOT_ALREADY_RUNNING:')) {
            const pid = String(err.message).split(':')[1] || 'desconocido';
            console.error(`Ya hay otra instancia del bot ejecutándose (PID ${pid}). Cierra la anterior para ahorrar RAM.`);
            process.exit(1);
        }

        console.error('No se pudo iniciar el bot:', err);
        await releaseProcessLock();
        process.exit(1);
    }
}

async function shutdown(signal) {
    try {
        console.log(`Recibido ${signal}, cerrando bot...`);
        await client.destroy();
    } catch {
        // ignore shutdown errors
    } finally {
        await releaseProcessLock();
        process.exit(0);
    }
}

process.on('SIGINT', () => {
    shutdown('SIGINT');
});

process.on('SIGTERM', () => {
    shutdown('SIGTERM');
});

process.on('exit', () => {
    releaseProcessLock();
});

module.exports = {
    startBot
};
