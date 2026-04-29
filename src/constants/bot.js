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

const BLOCKED_USER_MESSAGE = 'Los k 💪 no pueden usar el bot temporalmente';

const BOT_STICKER_NAME = 'VanirBot';
const R34_ALLOWED_MEDIA_PATH = '/images/';
const R34_VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.avi']);
const R34_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const R34_MAX_REPEAT_PER_POST = 2;
const R34_MAX_RETRY_ATTEMPTS = 6;
const R34_HISTORY_LIMIT = 120;

const PINTEREST_COOKIES = process.env.PINTEREST_COOKIES || '_b=AZP1F0UkFdlHeadIxQL9LCxNhyvI1i8zXLIwQIBuLD4c9/SkObPFldlrFxaWQN3ttkw=; _pinterest_sess=TWc9PSZ0R3VESUFPc2xwQ2x3MlVwb0wxT1VTVCtUSWJkYkt0WTR6S2J3KzNmRm0xUjdDOUhTdnZQdkJsME52RnorN1B3SGZPdU1lTkc0d2dHcFU0dk1mUUFUd2NyM3RaWEtuNmc4eEgrdUZvQzhZalpudS9rZVJpS2k1QnBVSUdqWEJvYyttVHhiQ1dsSVNlVTg0MlZybVZBb0VvUURtVDhEaWdweUprRFJyL1RyQWlMeWFPVTl4SStmelJoaXNvaVM0cHlFTk0rK0wrbFNXUG9taDBZVEZNVVlkR2tuRjgzU25taDczYVVqS3h2N2ptNTVsUnM1WnFKZlVlZXRDc0JrUUJnMllPd2FDT056SWdtLzl6K1RZdnFWZ3RWZlNYRUJhNzVrSXJkMHRzWnZpa212RUdrZkdjc25LZW1UTlVMK2crTmgyQzNMV2g0OTR3YVFjVjVZZEp0c3pKaDdsa0pnMW4xODVJTFc2cStUL2RvNThTWTNyeXJWOXYyeGVtWmdGMGY4a2tJeTlIVlNnbVA0OE5yb29OeWZ2RUFrOHdTSmpna253aHV4aGt2YzFzenZjbXZrM3R5TDZpWlpHNXI2aFVvcFpNYTZ4OUlPb0ZsTWVRSDAvZUVMMHYxRnM4Y3FOakdHa3BIMW1rZXpvalUyWGpGa2h1eTFRV0xobFRsU0Y0Y2NVUS9DNGlDUERFL1JTczI0YVRhTk1lNEE2VFJybi9RYU1WYTlTbnRialQ3MG0xV09VQ3NWOEgwakgzNGk0M0UzdUc1TlhZRHdtN0oxUkZNaW5tYmFIdlBhaEhwbmQvNWJQbE1JdktyV3FCUTM3ZjlMQ05MeWJyNFR4OWdXVWw5SmxLR1hrWTYwRUROY2Iyb1BidUFSSTUzbVdPNUR4NUVzWmttcnBSMGNWZncrblZFY0VidXR2NXhwWE1TOVNqTFo0b2Z5TldMWm1JYTB0eDlTMXJBWEhwV2tqUEdGVzVQUGdxOFljQWJ5MVRINEl6OGZzV0FodnlHZTFlQnVEKzRKRWVtWk8yVW9kazJISlFlT1g3WXpTUzI1ek1vMFNBam10cjlDQ3hha0o1YnBoK2haN293Z2xpRnVPMkdHcjdoNXVTc1NvcGFJeE5rRjg1UjRsUWNiZWUxN2drbWFhSEVYVVJOQXZrdWd6SWo0MmM4NjFhbmhQclVpUEpZYnBPQkNQdW5DQ1VnUkV2QXVDUm1VR2tEZVlGVzR5NUZFM0hvZ2VIVlJnamhoMFRZMHRQenJBWXcxVjlaQU5kUTNOWGJWR0p5cnNIYkdXSytSRjR6NEJ0VjZmQ3A3em0zaWFGNDlTM05aKzZGRmg3d1BvalVvUTh6TmhRZHFvbmpYTVRJZmY1MzVMT1IrekNmRkY1aDdqd2IrZFFrU3RWbmVTSzBoOWlHN1g0RytwNnpOSURjZkxLenI2Vm1sTlBMWGVrSzVFZGtLRXBDR0ZIL0tFbHNzQlg1NCtIc2dLOUxSTG8wQzQvbHBuZHZBK3dOaHlDbXAzdXdTSHQ5TXh4dEJEcVFJYUZLNExpd2tiYXlPK3B6TlJzWlpRalA5RURxSWJJcEZQOHU5djhId24reFg0d1JPb3lZbWJJTGdrcGo4U3cvT0lVMDJpanBDQTZjcHVRL1JWLzRCL2lPK0tTZnl0eTNFcmpxNDg5WDdqUWsyMGplOW9xZ0NjcjJsc1VTZTQ3TThYdDdXelV6MVo5THlwb2c3SVNCVm9IMG1tZ1dpWjBhY2xoNXpNMUQya3lvalYwekVuaUlPNmJNU0ZkUWhwUU8mV3JxcVo4akFWWkZ5ZTArSldjckc3SHlzdzk4PQ==';

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
    BLOCKED_USER_MESSAGE,
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
    ,
    PINTEREST_COOKIES
};
