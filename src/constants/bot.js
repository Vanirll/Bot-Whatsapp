const path = require('node:path');

const MENU_TEXT =
    '📋 *Comandos*\n' +
    '• *.menu* → mostrar este menú\n' +
    '• *.ping* → medir respuesta del bot\n' +
    '• *.s* → crear sticker desde imagen\n' +
    '\n'+
    '• *.ds <url>* → descargar videos\n' +
    '• *.dsb <titulo>* → buscar 3 videos\n' +
    '\n'+
    '• *.pt <busqueda> <cantidad>* → buscar en Pinterest (max 15)\n' +
    '\n'+
    '• *.mp3 <url>* → audio reproducible\n' +
    '• *.mp3d <url>* → audio como documento\n';

const BOT_STICKER_NAME = 'VanirBot';
const R34_ALLOWED_MEDIA_PATH = '/images/';
const R34_VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.avi']);
const R34_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const R34_MAX_REPEAT_PER_POST = 2;
const R34_MAX_RETRY_ATTEMPTS = 6;
const R34_HISTORY_LIMIT = 120;

const DOCUMENTS_BASE_DIRECTORY = path.resolve(__dirname, '../Documents');
const R34_INFO_DIRECTORY = path.join(DOCUMENTS_BASE_DIRECTORY, '34');
const DS_INFO_DIRECTORY = path.join(DOCUMENTS_BASE_DIRECTORY, 'Ds');
const PT_INFO_DIRECTORY = path.join(DOCUMENTS_BASE_DIRECTORY, 'Pt');
const R34_SEARCHES_LOG_FILE = path.join(R34_INFO_DIRECTORY, 'r34-searches-log.txt');
const DS_DOWNLOADS_LOG_FILE = path.join(DS_INFO_DIRECTORY, 'ds-downloads-log.txt');
const PT_DOWNLOADS_LOG_FILE = path.join(PT_INFO_DIRECTORY, 'pt-downloads-log.txt');
const PT_DOWNLOADS_LOG_CSV_FILE = path.join(PT_INFO_DIRECTORY, 'pt-downloads-log.csv');

module.exports = {
    MENU_TEXT,
    BOT_STICKER_NAME,
    R34_ALLOWED_MEDIA_PATH,
    R34_VIDEO_EXTENSIONS,
    R34_IMAGE_EXTENSIONS,
    R34_MAX_REPEAT_PER_POST,
    R34_MAX_RETRY_ATTEMPTS,
    R34_HISTORY_LIMIT,
    R34_INFO_DIRECTORY,
    DS_INFO_DIRECTORY,
    PT_INFO_DIRECTORY,
    R34_SEARCHES_LOG_FILE,
    DS_DOWNLOADS_LOG_FILE,
    PT_DOWNLOADS_LOG_FILE,
    PT_DOWNLOADS_LOG_CSV_FILE
};
