const { performance } = require('../../config');

let activeDownloads = 0;
const downloadQueue = [];

function getActiveDownloads() {
    return activeDownloads;
}

function acquireDownloadSlot() {
    return new Promise((resolve) => {
        const tryStart = () => {
            if (activeDownloads < performance.maxConcurrentDownloads) {
                activeDownloads += 1;
                resolve(() => {
                    activeDownloads = Math.max(0, activeDownloads - 1);
                    const next = downloadQueue.shift();
                    if (next) {
                        next();
                    }
                });
                return;
            }

            downloadQueue.push(tryStart);
        };

        tryStart();
    });
}

module.exports = {
    getActiveDownloads,
    acquireDownloadSlot
};
