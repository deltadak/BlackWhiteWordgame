// Import the appropriate service and chosen wrappers
const {
  dialogflow,
  Confirmation
} = require('actions-on-google');

const functions = require('firebase-functions');
const config = require('./config');
const storage = require('./storage');
const {getWord} = require('./generator');
const {shuffle} = require('./utils');
const {handleEasterEggs} = require('./eastereggs');

// Create an app instance
const app = dialogflow();

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
    WIN: `<audio src="${storage.getAudio('win.mp3')}">Win soundeffect</audio>`
};

const MUSIC_FADEOUT = 7;
const MUSIC_QUEUE = 2;
function getWaitMusicTag(conv) {
	if (conv.data.music_timestamp === -1) {
		// first instance
		conv.data.music_timestamp = new Date();
	} else {
		var timeStamp = new Date();
		var offset = conv.data.music_offset;
		
		offset += (timeStamp.getTime() - new Date(conv.data.music_timestamp).getTime()) / 1000;
		var current_index = conv.data.music_index;
		
		while (offset > conv.data.music[current_index].duration - MUSIC_FADEOUT) {
			offset = Math.max(offset - conv.data.music[current_index].duration, 0);
			current_index = (current_index + 1) % conv.data.music.length;
		}
		conv.data.music_timestamp = timeStamp;
		conv.data.music_index = current_index;
		conv.data.music_offset = offset;
	}
	var audioTag = "";
	var index = conv.data.music_index;
	for (let i = 0; i < MUSIC_QUEUE; i++) {
		offsetTag = (i === 0 && conv.data.music_offset > 1) ? `clipBegin="${Math.floor(conv.data.music_offset)}s"` : "";
		audioTag += `<audio ${offsetTag} src="${storage.getMusic(conv.data.music[index].name)}">Wacht muziek</audio>`;
		index = (index + 1) % conv.data.music.length;
	}
	return audioTag;
}

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

app.intent('resume_last', (conv) => {
	conv.data.word = conv.user.storage.lastword;
	wordLength = conv.data.word.length;
	
	return conv.ask(`
            <speak>Okee, het vorige woord was een woord met ${wordLength} letters. Je kunt nu raden.`
                + `${getWaitMusicTag(conv)} </speak>`);
});

function startGame(conv, wordLength, explanation) {
    return getWord(parseInt(wordLength), true).then((word) => {
		if (conv.user.verification === 'VERIFIED') {
			conv.user.storage.lastword = word.toLowerCase();
			conv.user.storage.finishedlast = false;
		}
		
        conv.data.word = word.toLowerCase();
        return conv.ask(`
            <speak>Okee, ik heb een woord met ${wordLength} letters.`
                + (explanation ? `Je kunt nu raden door te zeggen <break time="500ms"/> Hey Google, probeer <break time="500ms"/> gevolgd door het woord wat je wilt raden.` : `Je kunt nu raden.`)
                + `${getWaitMusicTag(conv)} </speak>`);
    });
}

app.intent('word_length', (conv, {wordLength}) => {
    return startGame(conv, wordLength, true);
});

app.intent('provide_guess', (conv, {word}) => {
    word = word.toLowerCase();
    // Remove apostrophes
    word = removeCharacter(word, "'");
    // Remove hyphen
    word = removeCharacter(word, "-");

    handleEasterEggs(conv, word);

    if (word.indexOf(' ') >= 0) {
        if (!checkSpelledWord(word, conv.data.word.length)) {
            conv.ask(`<speak>Probeer 1 woord te geven.${getWaitMusicTag(conv)}</speak>`);
            return;
        } else {
            word = concatenateWord(word);
        }
    }
    
    if (word.length !== conv.data.word.length) {
        conv.ask(`<speak>${word} heeft niet de juiste lengte, geef een woord ter lengte ${conv.data.word.length}. ${getWaitMusicTag(conv)}</speak>`);
    } else if (word === conv.data.word) {
		conv.contexts.delete('game');
        conv.contexts.set('request_restart', 2);
		
		if (conv.user.verification === 'VERIFIED') {
			conv.user.storage.lastword = conv.data.word;
			conv.user.storage.finishedlast = true;
		}

        conv.ask(`
            <speak>
                ${Sounds.WIN}
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
        
        conv.ask(`<speak>${word} ${spellSlow(word)} heeft ${getBlackWhiteResponse(blacks, whites)}. ${getWaitMusicTag(conv)}</speak>`);
    }
});


app.intent('repeat_blacks_whites', (conv) => {
    conv.ask(`<speak>Het woord ${conv.data.prevWord} ${spellSlow(conv.data.prevWord)} gaf ${getBlackWhiteResponse(conv.data.prevBlacks, conv.data.prevWhites)}. ${getWaitMusicTag(conv)}</speak>`);
});

app.intent('spoiler_no', (conv) => {
    conv.ask(`<speak>${getWaitMusicTag(conv)}</speak>`);
});

app.intent('spoiler_yes', (conv) => {
	if (conv.user.verification === 'VERIFIED') {
		conv.user.storage.lastword = conv.data.word;
		conv.user.storage.finishedlast = true;
	}
	
    conv.ask(`<speak>Okee, het woord was ${conv.data.word} ${spellSlow(conv.data.word)}. Wil je een nieuw spel beginnen?</speak>`);
});

function initialize(conv, letterCount) {
	if (typeof letterCount  !== 'undefined' && letterCount) {
        conv.contexts.set('game', 5);
        return startGame(conv, letterCount, false);
    } else {
		if (conv.user.verification === 'VERIFIED') {
			if ('lastword' in conv.user.storage && 'finishedlast' in conv.user.storage) {
				if (!conv.user.storage.finishedlast) {
					// Ask user to return to last game
					
					conv.contexts.set('decide_resume_last', 1);
					conv.contexts.set('decide_start_game', 1);
					return conv.ask(`
						<speak>
						<prosody pitch="+2st">Hoi!</prosody>
						  Welkom bij het zwart-wit  <break time="50ms"/> woordspel!
						  Het lijkt erop dat je het vorige woord niet hebt geraden. Wil je hiermee verder spelen? Of wil je een nieuw spel beginnen?
						</speak>`);
				}
			}
		}
        conv.contexts.set('decide_instruction_game', 1);
        conv.contexts.set('decide_start_game', 1);
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
}

async function fetchMusicList() {
	const https = require('https');
    return new Promise((resolve, reject) => {
        https.get(storage.getMusicList(), (resp) => {
		  let data = '';

		  // A chunk of data has been received.
		  resp.on('data', (chunk) => {
			data += chunk;
		  });

		  // The whole response has been received. Print out the result.
		  resp.on('end', () => {
			resolve(JSON.parse(data));
		  });

		});
    })
}

app.intent('welcome', async (conv, {letterCount}) => {
	return fetchMusicList().then(
		json => {
			conv.data.music = shuffle(json.music);
			conv.data.music_index = 0;
			conv.data.music_offset = 0;
			conv.data.music_timestamp = -1;
			return initialize(conv, letterCount);
		}).catch(() => {
			return conv.close("Sorry, het lijkt erop dat de spelserver momenteel niet beschikbaar is. Probeer het later opnieuw.");
		});
});

app.intent('guess_fallback', (conv) => {
    return conv.ask(`<speak>${getWaitMusicTag(conv)}</speak>`);
});

app.intent('no_input_game_intent', (conv) => {
    return conv.ask(`<speak>${getWaitMusicTag(conv)}</speak>`);
});


exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);