const config = require('./config');

function getMusic(e) {
	return `${config.STORAGE_BASE_URL}/audio/music/${e}`;
}

function getAudio(e) {
	return `${config.STORAGE_BASE_URL}/audio/${e}`;
}

function getMusicList() {
	return `${config.STORAGE_BASE_URL}/audio/music/list.json`;
}

function getEaster(e) {
	return `${config.STORAGE_BASE_URL}/audio/easter/${e}`;
}

module.exports = {
	getMusic,
	getAudio,
	getMusicList,
	getEaster,
}