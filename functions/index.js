// Import the appropriate service and chosen wrappers
const {
  dialogflow,
  Confirmation
} = require('actions-on-google');

const functions = require('firebase-functions');
const {getWord} = require('./generator');
const {handleEasterEggs} = require('./eastereggs');

// Create an app instance
const app = dialogflow();
const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);

const {Storage} = require('@google-cloud/storage')
const firebaseStorage = new Storage({
    projectId: `${firebaseConfig.projectId}`,
    keyFilename: 'storage-service-account.json',
});

const bucket = firebaseStorage.bucket(`${firebaseConfig.projectId}.appspot.com`);
	
async function getRandomWaitingSound() {
	const [files] = await bucket.getFiles({
		  prefix: 'audio/music/',
		  delimiter: '/' // in order to only get files in this folder
		});
	
	var file = null;
	do {
		file = files[Math.floor(Math.random()*files.length)];
	} while (file.name.endsWith("/"));
	
	return file.publicUrl();
}

const waitingSoundRepeat = 5;
async function repeatRandomWaitingSound() {
	const queue = [];
	for (let i = 0; i < waitingSoundRepeat; i++) {
		queue.push(getRandomWaitingSound());
	}
	const results = await Promise.all(queue);
	return results.map(r => `<audio src="${r}">Waiting song</audio>`).join(" ");
}

async function getFirebaseStorageElement(e) {
	return await bucket.file(e).publicUrl();
}

const spellSlow = (word) => `<break time="200ms"/><prosody rate="slow"><say-as interpret-as="verbatim">${word}</say-as></prosody>`;

function getBlackWhiteResponse(black, white) {
    if (black === 0 && white === 0) {
        return "geen overeenkomsten";
    }

    let s = "";
    if (black > 0) {
        s += `${black} zwarte`;
    }
    if (white > 0) {
        if (black > 0) {
            s += ` en `;
        }
        s += `${white} witte`;
    }
    return s;
}

function removeCharacter(word, char) {
    return word.split(char).join("");
}

function concatenateWord(word) {
    return removeCharacter(word, " ");
}

function checkSpelledWord(word, wordLength) {
    concatWord = concatenateWord(word);
    
    if (concatWord.length === wordLength) {
        return true;
    }
    return false;
}

const Sounds = {
    WAIT: async() => await repeatRandomWaitingSound(),
    WIN: async() => `<audio src="${await getFirebaseStorageElement('audio/win.mp3')}">Win soundeffect</audio>`
};

function blackWhites(word, attempt) {
    word = word.toLowerCase();
    attempt = attempt.toLowerCase();
    const wordArray = word.split("");
    const attemptArray = attempt.split("");

    let blacks = 0;
    let whites = 0;
    const maskedWord = word.split("");
    const maskedAttempt = attempt.split("");

    zip = (...rows) => [...rows[0]].map((_,c) => rows.map(row => row[c]));

    zip(attemptArray, wordArray).forEach((item, index) => {
        const a = item[0];
        const b = item[1];
        if (a === b) {
            aIndex = maskedWord.indexOf(a);
            maskedWord.splice(aIndex, 1);
            aIndexAttempt = maskedAttempt.indexOf(a);
            maskedAttempt.splice(aIndexAttempt, 1);
            blacks += 1
        }
    });

    maskedAttempt.forEach((item, index) => {
        aIndex = maskedWord.indexOf(item);
        if (aIndex > -1) {
            maskedWord.splice(aIndex, 1);
            whites += 1
        }
    });
    
    return [blacks, whites]
}

async function startGame(conv, wordLength, explanation) {
    return getWord(parseInt(wordLength), true).then(async (word) => {
        conv.data.word = word.toLowerCase();
        return conv.ask(`
            <speak>Okee, ik heb een woord met ${wordLength} letters.`
                + (explanation ? `Je kunt nu raden door te zeggen <break time="500ms"/> Hey Google, probeer <break time="500ms"/> gevolgd door het woord wat je wilt raden.` : `Je kunt nu raden.`)
                + `${await (Sounds.WAIT())} </speak>`);
    });
}

app.intent('word_length', async (conv, {wordLength}) => {
    return startGame(conv, wordLength, true);
});

app.intent('provide_guess', async (conv, {word}) => {
    word = word.toLowerCase();
    // Remove apostrophes
    word = removeCharacter(word, "'");
    // Remove hyphen
    word = removeCharacter(word, "-");

    await handleEasterEggs(conv, word);

    if (word.indexOf(' ') >= 0) {
        if (!checkSpelledWord(word, conv.data.word.length)) {
            conv.ask(`<speak>Probeer 1 woord te geven.${await (Sounds.WAIT())}</speak>`);
            return;
        } else {
            word = concatenateWord(word);
        }
    }
    
    if (word.length !== conv.data.word.length) {
        conv.ask(`<speak>${word} heeft niet de juiste lengte, geef een woord ter lengte ${conv.data.word.length}. ${await (Sounds.WAIT())}</speak>`);
    } else if (word === conv.data.word) {
		conv.contexts.delete('game');
        conv.contexts.set('request_restart', 2);

        conv.ask(`
            <speak>
                ${await (Sounds.WIN())}
                <break time="500ms"/>
                <p>
                    <prosody pitch="+3st">
                        <s>Goed gedaan!</s> 
                    </prosody>
                    <s>Je hebt het woord geraden!</s>
                </p>
                <par>
                    <media xml:id="question" begin="0.5s">
                        <speak>Wil je een nieuw spel beginnen?</speak>
                    </media>
                </par>
            </speak>`);
    } else {
        [blacks, whites] = blackWhites(conv.data.word, word);
        conv.data.prevWord = word;
        conv.data.prevBlacks = blacks;
        conv.data.prevWhites = whites;
        
        conv.ask(`<speak>${word} ${spellSlow(word)} heeft ${getBlackWhiteResponse(blacks, whites)}. ${await (Sounds.WAIT())}</speak>`);
    }
});


app.intent('repeat_blacks_whites', async (conv) => {
    conv.ask(`<speak>Het woord ${conv.data.prevWord} ${spellSlow(conv.data.prevWord)} gaf ${getBlackWhiteResponse(conv.data.prevBlacks, conv.data.prevWhites)}. ${await (Sounds.WAIT())}</speak>`);
});

app.intent('restart_game', async (conv, input, confirmation) => {
    if (confirmation) {
        conv.contexts.set('decide_word_length', 2);
        conv.ask(`Hoeveel letters mag het nieuwe woord zijn?`)
    } else {
        conv.close(`Okee! Tot ziens.`)
    }
});

app.intent('spoiler_no', async (conv) => {
    conv.ask(`<speak>${await (Sounds.WAIT())}</speak>`);
});

app.intent('spoiler_yes', async (conv) => {
    conv.ask(`<speak>Okee, het woord was ${conv.data.word} ${spellSlow(conv.data.word)}. Wil je een nieuw spel beginnen?</speak>`);
});

app.intent('welcome', async (conv, {letterCount}) => {
    if (typeof letterCount  !== 'undefined' && letterCount) {
        conv.contexts.set('game', 5);
        return startGame(conv, letterCount, false);
    } else {
        conv.contexts.set('decide_instruction_game', 1);
        return conv.ask(`
            <speak>
              <prosody pitch="+2st">Hoi!</prosody>
              Welkom bij het zwart-wit  <break time="50ms"/> woordspel! 
              <par>
                <media xml:id="question">
                    <speak>Wil je de instructies horen?</speak>
                </media>
              </par>
               Of wil je direct een spel beginnen.
            </speak>`);
    }
});

app.intent('guess_fallback', async (conv) => {
    return conv.ask(`<speak>${await (Sounds.WAIT())}</speak>`);
});

app.intent('no_input_game_intent', async (conv) => {
    return conv.ask(`<speak>${await (Sounds.WAIT())}</speak>`);
});


exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);