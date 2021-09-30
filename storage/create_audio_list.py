import eyed3
import json
from os import listdir
from os.path import isfile, join

musicpath = 'audio/music'
d = {}
d['music'] = []
for f in [f for f in listdir(musicpath) if isfile(join(musicpath, f)) and f.endswith("mp3")]:
    duration = eyed3.load(join(musicpath, f)).info.time_secs
    d['music'].append(
    {
        'name' : f,
        'duration' : duration
    })
with open(join(musicpath, 'list.json'), 'w') as musiclist:
    json.dump(d, musiclist)
