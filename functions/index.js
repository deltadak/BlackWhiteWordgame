// Import the appropriate service and chosen wrappers
const {
  dialogflow,
  Confirmation
} = require('actions-on-google');

const functions = require('firebase-functions');
const {getWord} = require('./generator');

// Create an app instance
const app = dialogflow();

const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);

const baseUrl = `https://${firebaseConfig.projectId}.firebaseapp.com`;

const getSound = (sound) => `${baseUrl}/audio/${sound}`;

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

function concatenateWord(word) {
    return word.split(" ").join("");
}

function checkSpelledWord(word, wordLength) {
    concatWord = concatenateWord(word);
    
    if (concatWord.length === wordLength) {
        return true;
    }
    return false;
}

const Sounds = {
    WAIT: `<audio src="${getSound('green-onions.mp3')}">Green onion song</audio>`,
    WIN: `<audio src="${getSound('win.mp3')}">Win soundeffect</audio>`
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

app.intent('fixed_word_length', (conv, {wordLength}) => {
    return getWord(parseInt(wordLength), true).then((word) => {
        conv.data.word = word.toLowerCase();
        conv.ask(`
            <speak>Okee, ik heb een woord met ${wordLength} letters. Je kunt nu raden door te zeggen <break time="500ms"/> Hey Google, probeer <break time="500ms"/> gevolgd door het woord wat je wilt raden.
            ${Sounds.WAIT}
            </speak>`);
        return null;
    });
});

app.intent('provide_guess', (conv, {word}) => {
    word = word.toLowerCase();
    
    if (word.indexOf(' ') >= 0) {
        if (!checkSpelledWord(word, conv.data.word.length)) {
            conv.ask(`<speak>Probeer 1 woord te geven.${Sounds.WAIT}</speak>`);
            return;
        } else {
            word = concatenateWord(word);
        }
    }
    
    if (word.length !== conv.data.word.length) {
        conv.ask(`<speak>${word} heeft niet de juiste lengte, geef een woord ter lengte ${conv.data.word.length}. ${Sounds.WAIT}</speak>`);
    } else if (word === conv.data.word) {
        //conv.ask(`<speak>${Sounds.WIN}</speak>`);
        conv.ask(new Confirmation(`Goed gedaan! Wil je een nieuw spel beginnen?`));
    } else {
        [blacks, whites] = blackWhites(conv.data.word, word);
        conv.data.prevWord = word;
        conv.data.prevBlacks = blacks;
        conv.data.prevWhites = whites;
        
        conv.ask(`<speak>${word} ${spellSlow(word)} heeft ${getBlackWhiteResponse(blacks, whites)}. ${Sounds.WAIT}</speak>`);
    }
});


app.intent('repeat_blacks_whites', (conv) => {
    conv.ask(`<speak>Het woord ${conv.data.prevWord} ${spellSlow(conv.data.prevWord)} gaf ${getBlackWhiteResponse(conv.data.prevBlacks, conv.data.prevWhites)}. ${Sounds.WAIT}</speak>`);
});

app.intent('restart_game', (conv, input, confirmation) => {
    if (confirmation) {
        conv.contexts.set('decide_word_length', 2);
        conv.ask(`Hoeveel letters mag het nieuwe woord zijn?`)
    } else {
        conv.close(`Okee! Tot ziens.`)
    }
});

app.intent('guess_fallback', (conv) => {
    conv.ask(`<speak>${Sounds.WAIT}</speak>`);
});

app.intent('spoiler_no', (conv) => {
    conv.ask(`<speak>${Sounds.WAIT}</speak>`);
});

app.intent('spoiler_yes', (conv) => {
    conv.ask(`<speak>Okee, het woord was ${conv.data.word} ${spellSlow(conv.data.word)}. Wil je een nieuw spel beginnen?</speak>`);
});


exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);