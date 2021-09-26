import firebase_admin
import random
from firebase_admin import credentials
from firebase_admin import firestore

# Use a service account
cred = credentials.Certificate('db-service-account.json')
firebase_admin.initialize_app(cred)

db = firestore.client()

# Settings
collection_name = 'dict-nl'
batch_size = 499

d = open('nl.txt', 'r')
lines = d.readlines()

batch_index = 0
current_batch_size = 0
batch = db.batch()

for line in lines:
    word = line.strip()
    word_doc = db.collection(collection_name).document()
    batch.set(word_doc, {
        u'word': word, 
        u'length': len(word),
        u'random': random.randint(0, 2**32-1)
        }
    )

    current_batch_size = current_batch_size + 1
    
    if current_batch_size >= batch_size:
        print("Commiting batch: ", batch_index)
        batch.commit()
        
        batch = db.batch()
        current_batch_size = 0
        batch_index = batch_index + 1

batch.commit()