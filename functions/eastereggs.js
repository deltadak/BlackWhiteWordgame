const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);

const baseUrl = `https://${firebaseConfig.projectId}.firebaseapp.com`;

const getSound = (sound) => `${baseUrl}/audio/easter/${sound}`;

const getAudioTag = (sound) => `<speak><audio src="${getSound(sound)}">${sound}</audio></speak>`;

const eggs = {
    // Audio easter eggs
    'stoomboot' : getAudioTag('boat.mp3'),
    'fart' : getAudioTag('fart.mp3'),
    'scheet' : getAudioTag('fart.mp3'),
    'banana' : getAudioTag('minionbanana.mp3'),
    'banaan' : getAudioTag('minionbanana.mp3'),
    // Sentence easter eggs
    'google' : "<p><p><s>Hee!</s><s>Dat ben ik!</s></p></speak>",
};

function handleEasterEggs(conv, word) {
    if (word in eggs) {
        conv.ask(eggs[word]);
    }
}

module.exports = {handleEasterEggs};