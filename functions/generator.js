const admin = require("firebase-admin");
const functions = require('firebase-functions');
const crypto = require('crypto');
admin.initializeApp(functions.config().firebase);

let db = admin.firestore();

function getWord(length, isDutch) {
    if (isDutch) {
        dictCollection = 'dict-nl'
    }
    
    let random32BitInt = crypto.randomBytes(4).readUInt32BE(0, true);
    
    let queryRef = db.collection(dictCollection);
    let query = queryRef
                    .where('length', '==', length)
                    .where('random', '>=', random32BitInt)
                    .orderBy('random')
                    .limit(1)
                    
    return query.get().then(snapshot => {
        snapshot.forEach(doc => {
            returnword = doc.data()['word']
        });
        return returnword;
    })
}

module.exports = {getWord};