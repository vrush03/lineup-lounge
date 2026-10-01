"""Fetch a portrait for every Showdown player into public/players/ (macOS: uses `sips` to resize).

player_photos.json says where each picture comes from: `image` is the file to download and
`source` the page it was found on. A player with no entry gets the lead image from their Wikipedia
infobox (the pages gen_cards.py caches), and that is then written to the manifest.

Cut-outs on a transparent background (the ICC's headshots) are kept as .webp so the card's team
colour shows behind them; everything else becomes a 480px-wide .jpg. Files that already exist are
left alone: to replace a photo, delete it, change its manifest entry and run this again, then run
gen_cards.py so the cards point at the new files.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from gen_cards import PLAYERS, PUBLIC, infobox, slug  # noqa: E402

MANIFEST = os.path.join(os.path.dirname(__file__), 'player_photos.json')
OUT = os.path.join(PUBLIC, 'players')
WIDTH, MAX_HEIGHT = 480, 660
# Image hosts turn away the default Python client.
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) '
                    'Chrome/126.0 Safari/537.36', 'Accept': 'image/webp,image/png,image/jpeg,image/*'}


def players():
    spec = json.load(open(PLAYERS))
    seen = {}
    for deck in spec['decks'].values():
        for name in deck:
            seen.setdefault(slug(name), (name, spec['overrides'].get(name, {}).get('wiki', name)))
    return seen


def wikipedia(name, title):
    """Manifest entry for the lead image of a player's Wikipedia article, or None if it has none."""
    box = infobox(title)
    if not box['image']:
        return None
    # Thumbnails come in fixed widths; 500px is the step above the card's 480.
    image = re.sub(r'/\d+px-', '/500px-', box['image'])
    # .../thumb/3/3e/<file>/500px-<file> for a thumbnail, .../3/3e/<file> for an original.
    file = urllib.parse.unquote(image.split('/thumb/')[1].split('/')[2] if '/thumb/' in image
                                else image.rsplit('/', 1)[1])
    return {'player': name, 'image': image,
            'source': 'https://commons.wikimedia.org/wiki/File:' + urllib.parse.quote(file),
            'credit': 'Wikimedia Commons; see the source page for author and licence'}


def download(url):
    for attempt in range(6):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 5:
                raise
            time.sleep(int(e.headers.get('Retry-After') or 0) or 20 * (attempt + 1))


def save(data, base):
    """Write <base>.webp for a transparent cut-out, else <base>.jpg at card width."""
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP' and b'ALPH' in data:  # WebP with an alpha channel
        open(base + '.webp', 'wb').write(data)
        return
    path = base + '.jpg'
    with tempfile.NamedTemporaryFile(suffix='.img') as raw:
        raw.write(data)
        raw.flush()
        subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '78', '--resampleWidth', str(WIDTH),
                        raw.name, '--out', path], check=True, capture_output=True)
    height = int(subprocess.run(['sips', '-g', 'pixelHeight', path], check=True, capture_output=True, text=True)
                 .stdout.split()[-1])
    if height > MAX_HEIGHT:  # keep the top of very tall pictures, where the face is
        subprocess.run(['sips', '--cropOffset', '0', '0', '-c', str(MAX_HEIGHT), str(WIDTH), path],
                       check=True, capture_output=True)


def main():
    manifest = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
    os.makedirs(OUT, exist_ok=True)
    todo = players()
    have = lambda s: any(os.path.exists(os.path.join(OUT, f'{s}.{ext}')) for ext in ('webp', 'jpg'))  # noqa: E731
    for s, (name, title) in todo.items():
        if have(s):
            continue
        entry = manifest.get(s) or wikipedia(name, title)
        if not entry:
            continue
        try:
            save(download(entry['image']), os.path.join(OUT, s))
        except Exception as e:  # one bad file shouldn't stop the rest
            print(f'failed {name}: {e!r}')
            continue
        manifest[s] = entry
        json.dump(dict(sorted(manifest.items())), open(MANIFEST, 'w'), indent=1, ensure_ascii=False)
        print(f'  {s}')
        time.sleep(1)
    missing = [name for s, (name, _) in todo.items() if not have(s)]
    print(f'{len(todo) - len(missing)} of {len(todo)} players have a photo' + (f"; none for {', '.join(missing)}" if missing else ''))


if __name__ == '__main__':
    main()
