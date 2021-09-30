const storage = require('./storage');

function getAudioTag(e) {
	return `<speak><audio src="${storage.getEaster(e)}">${e}</audio></speak>`;
}

const eggs = {
    // Audio easter eggs
    'stoomboot' : getAudioTag('boat.mp3'),
    'fart' : getAudioTag('fart.mp3'),
    'scheet' :getAudioTag('fart.mp3'),
    'banana' : getAudioTag('minionbanana.mp3'),
    'banaan' : getAudioTag('minionbanana.mp3'),
    // Sentence easter eggs
    'google' : "Hee! Dat ben ik!",
};

function handleEasterEggs(conv, word) {
    if (word in eggs) {
		const audioTag = eggs[word];
        conv.ask(audioTag);
    }
}

module.exports = {handleEasterEggs};