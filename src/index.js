const path = require('path');

const ffmpegPath = require('ffmpeg-static');

if (ffmpegPath) {
	process.env.FFMPEG_PATH = ffmpegPath;

	const ffmpegDir = path.dirname(ffmpegPath);
	const currentPath = process.env.PATH || '';
	if (!currentPath.toLowerCase().includes(ffmpegDir.toLowerCase())) {
		process.env.PATH = `${ffmpegDir}${path.delimiter}${currentPath}`;
	}
}

const { startBot } = require('./bot');

startBot();
