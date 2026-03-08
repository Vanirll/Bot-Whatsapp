const fs = require('node:fs/promises');
const path = require('node:path');

const lockFilePath = path.resolve(process.cwd(), '.bot.lock');

async function readLockPid() {
    try {
        const raw = await fs.readFile(lockFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        const pid = Number(parsed?.pid);
        if (!Number.isInteger(pid) || pid <= 0) return null;
        return pid;
    } catch {
        return null;
    }
}

function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

async function acquireProcessLock() {
    const existingPid = await readLockPid();

    if (existingPid && existingPid !== process.pid && isProcessAlive(existingPid)) {
        throw new Error(`BOT_ALREADY_RUNNING:${existingPid}`);
    }

    await fs.writeFile(
        lockFilePath,
        JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
        'utf8'
    );
}

async function releaseProcessLock() {
    try {
        const existingPid = await readLockPid();
        if (existingPid && existingPid !== process.pid) return;
        await fs.unlink(lockFilePath);
    } catch {
        // ignore cleanup errors
    }
}

module.exports = {
    acquireProcessLock,
    releaseProcessLock
};
