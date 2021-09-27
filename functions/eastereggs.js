const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);

const {Storage} = require('@google-cloud/storage')
const firebaseStorage = new Storage({
    projectId: `${firebaseConfig.projectId}`,
    keyFilename: 'storage-service-account.json',
});
const bucket = firebaseStorage.bucket(`${firebaseConfig.projectId}.appspot.com`);

async function getAudioTag(e) {
	const url = await bucket.file(`audio/easter/${e}`).publicUrl();
	return `<speak><audio src="${url}">${e}</audio></speak>`
}

const eggs = {
    // Audio easter eggs
    'stoomboot' : async() => await getAudioTag('boat.mp3'),
    'fart' : async() => await getAudioTag('fart.mp3'),
    'scheet' : async() => await getAudioTag('fart.mp3'),
    'banana' : async() => await getAudioTag('minionbanana.mp3'),
    'banaan' : async() => await getAudioTag('minionbanana.mp3'),
    // Sentence easter eggs
    'google' : async() => await "Hee! Dat ben ik!",
};

async function handleEasterEggs(conv, word) {
    if (word in eggs) {
		const audioTag = await (eggs[word]());
        conv.ask(audioTag);
    }
}

module.exports = {handleEasterEggs};