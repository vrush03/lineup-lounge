"""Build the Showdown decks: src/data/cards.json.

One deck per format, each a list of player cards with that format's career stats:
- Test, ODI and T20I from the career table in each player's Wikipedia infobox (Cricsheet lacks older
  and some withheld internationals, so its totals would be short). Pages are cached in
  data-raw/wiki/players/; delete a file (or pass --refresh) to fetch it again.
- IPL computed from Cricsheet (data-raw/build/player_matches.json, written by parse_cricsheet.py).

Who is in each deck is listed in cards_players.json. Every stat is "higher wins".
"""
import datetime
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from names import Names  # noqa: E402

HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, '..', '..', 'data-raw')
PAGES = os.path.join(ROOT, 'wiki', 'players')
PUBLIC = os.path.join(HERE, '..', '..', 'public')
OUT = os.path.join(HERE, '..', '..', 'src', 'data', 'cards.json')
PLAYERS = os.path.join(HERE, 'cards_players.json')
UA = {'User-Agent': 'LineupLounge/0.1 (cricket puzzle dataset build)'}
DECK_SIZE = 30  # cards dealt per game (15 a side); a deck needs at least this many

STAT = {
    'matches': {'key': 'matches', 'label': 'Matches', 'short': 'Mat'},
    'runs': {'key': 'runs', 'label': 'Runs', 'short': 'Runs'},
    'average': {'key': 'average', 'label': 'Batting average', 'short': 'Avg', 'decimals': 2},
    'strikeRate': {'key': 'strikeRate', 'label': 'Strike rate', 'short': 'SR', 'decimals': 2},
    'hundreds': {'key': 'hundreds', 'label': 'Hundreds', 'short': '100s'},
    'fifties': {'key': 'fifties', 'label': 'Fifties', 'short': '50s'},
    'sixes': {'key': 'sixes', 'label': 'Sixes', 'short': '6s'},
    'highest': {'key': 'highest', 'label': 'Highest score', 'short': 'HS'},
    'wickets': {'key': 'wickets', 'label': 'Wickets', 'short': 'Wkts'},
    'catches': {'key': 'catches', 'label': 'Catches', 'short': 'Ct'},
}
DECK_STATS = {
    'Test': ['matches', 'runs', 'average', 'hundreds', 'highest', 'wickets', 'catches'],
    'ODI': ['matches', 'runs', 'average', 'hundreds', 'highest', 'wickets', 'catches'],
    'T20I': ['matches', 'runs', 'average', 'fifties', 'highest', 'wickets', 'catches'],
    'IPL': ['matches', 'runs', 'strikeRate', 'sixes', 'highest', 'wickets', 'catches'],
}
# Infobox row label -> what it holds.
COLUMN = {'Tests': 'Test', 'ODIs': 'ODI', 'T20Is': 'T20I'}
ROWS = {'Matches': 'matches', 'Runs scored': 'runs', 'Batting average': 'average', '100s/50s': 'tons',
        'Top score': 'highest', 'Wickets': 'wickets', 'Catches/stumpings': 'catches'}


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def page_path(title):
    return os.path.join(PAGES, title.replace(' ', '_') + '.json')


def fetch(title, refresh=False):
    path = page_path(title)
    if refresh or not os.path.exists(path):
        url = 'https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode(
            {'action': 'parse', 'page': title, 'prop': 'text|revid', 'redirects': 1, 'format': 'json'})
        for attempt in range(6):  # the API answers 429 after a short burst
            try:
                body = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
                break
            except urllib.error.HTTPError as e:
                if e.code != 429 or attempt == 5:
                    raise
                time.sleep(int(e.headers.get('Retry-After') or 0) or 20 * (attempt + 1))
        assert 'parse' in json.loads(body), f'no Wikipedia page for {title}'
        os.makedirs(PAGES, exist_ok=True)
        open(path, 'wb').write(body)
        json.dump({'date': datetime.date.today().isoformat()}, open(os.path.join(PAGES, '_fetched.json'), 'w'))
        time.sleep(2)
    return json.load(open(path))['parse']


def text(cell):
    """Cell contents without markup or footnote markers ("133[2]")."""
    plain = html.unescape(re.sub(r'<[^>]+>', '', re.sub(r'<style.*?</style>', '', cell, flags=re.S)))
    return re.sub(r'\[[^\]]*\]', '', plain).replace('\xa0', ' ').strip()


def number(s):
    """'15,921' -> 15921, '53.78' -> 53.78, and the dashes used for "none" -> 0."""
    s = s.replace(',', '').replace('−', '-').strip()
    if s in ('', '–', '—', '-'):
        return 0
    return float(s) if '.' in s else int(s)


def infobox(title, refresh=False):
    """Career table from a cricketer's infobox: {format: {stat: value}}, national side and lead image URL."""
    page = fetch(title, refresh)
    h = page['text']['*']
    start = h.find('Career statistics</th>')
    assert start > 0, f'{title}: no career statistics in the infobox'
    table = h[start:h.index('</table>', start)]
    rows = [[text(c) for c in re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', r, re.S)]
            for r in re.findall(r'<tr[^>]*>(.*?)</tr>', table, re.S)]
    rows = [r for r in rows if len(r) > 1]
    assert rows[0][0] == 'Competition', f'{title}: unexpected infobox header {rows[0]}'
    formats = [COLUMN.get(f, f) for f in rows[0][1:]]
    out = defaultdict(dict)
    for label, *cells in rows[1:]:
        key = ROWS.get(label)
        if not key:
            continue
        assert len(cells) == len(formats), f'{title}: ragged row {label}'
        for fmt, cell in zip(formats, cells):
            s = out[fmt]
            if key == 'tons':
                s['hundreds'], s['fifties'] = (number(x) for x in cell.split('/'))
            elif key == 'highest':
                s['highest'] = number(cell.rstrip('*'))
                s['hsNotOut'] = cell.endswith('*')
            elif key == 'catches':
                s['catches'] = number(cell.split('/')[0])
            else:
                s[key] = number(cell)
    for s in out.values():
        s.setdefault('wickets', 0)  # the row is left out for players who never took one
    img = re.search(r'class="infobox-image".*?<img[^>]*src="([^"?]+)', h, re.S)
    source = re.search(r'Source:(.*?)</td>', h[start:], re.S)
    # The first side listed; cards_players.json overrides it for players better known for a later one.
    sides = re.search(r'National sides?</th><td[^>]*>(.*?)</td>', h, re.S)
    teams = [text(a) for a in re.findall(r'<a [^>]*>(.*?)</a>', sides.group(1), re.S)] if sides else []
    return {'formats': dict(out), 'image': 'https:' + html.unescape(img.group(1)) if img else None,
            'team': teams[0] if teams else None, 'revid': page['revid'], 'title': page['title'],
            'source': text(source.group(1)) if source else None}


def card(name, team, stats, keys):
    missing = [k for k in keys if not isinstance(stats.get(k), (int, float))]
    assert not missing, f'{name}: missing {missing}'
    c = {'id': slug(name), 'name': name, 'team': team, 'stats': {k: stats[k] for k in keys}}
    # A .webp is a cut-out on a transparent background. Cards without a photo show initials.
    photo = next((p for p in (f'/players/{slug(name)}.{ext}' for ext in ('webp', 'jpg')) if os.path.exists(PUBLIC + p)), None)
    if photo:
        c['photo'] = photo
    if stats.get('hsNotOut'):
        c['hsNotOut'] = True
    return c


def ipl_stats(names):
    """Career IPL figures per display name, with the franchise each player turned out for most."""
    matches = {m['id']: m for m in json.load(open(os.path.join(ROOT, 'build', 'matches.json'))) if m['fmt'] == 'IPL'}
    agg = defaultdict(Counter)
    best = {}   # pid -> (runs, not out)
    teams = defaultdict(Counter)
    for r in json.load(open(os.path.join(ROOT, 'build', 'player_matches.json'))):
        if r['mid'] not in matches:
            continue
        a = agg[r['pid']]
        a['matches'] += 1
        teams[r['pid']][r['team']] += 1
        for runs, balls, out in r['bat_inns']:
            a['runs'] += runs
            a['balls'] += balls
            best[r['pid']] = max(best.get(r['pid'], (0, False)), (runs, not out))
        for k in ('wkts', 'sixes', 'catches'):
            a[k] += r[k]
    by_name = defaultdict(list)
    for pid, a in agg.items():
        hs, not_out = best.get(pid, (0, False))
        by_name[names.info(pid)['name']].append({
            'matches': a['matches'], 'runs': a['runs'], 'sixes': a['sixes'], 'wickets': a['wkts'],
            'catches': a['catches'], 'highest': hs, 'hsNotOut': not_out,
            'strikeRate': round(100 * a['runs'] / a['balls'], 2) if a['balls'] else 0,
            'team': teams[pid].most_common(1)[0][0],
        })
    return by_name, max(m['date'] for m in matches.values())


def main():
    refresh = '--refresh' in sys.argv
    spec = json.load(open(PLAYERS))
    decks, overrides = spec['decks'], spec['overrides']
    out = []
    for fmt in ('Test', 'ODI', 'T20I'):
        cards = []
        for name in decks[fmt]:
            o = overrides.get(name, {})
            box = infobox(o.get('wiki', name), refresh)
            assert fmt in box['formats'], f"{name}: no {fmt} column in the infobox ({list(box['formats'])})"
            team = o.get('team') or box['team']
            assert team, f'{name}: no national side in the infobox'
            cards.append(card(name, team, box['formats'][fmt], DECK_STATS[fmt]))
        out.append({
            'format': fmt,
            'asOf': json.load(open(os.path.join(PAGES, '_fetched.json')))['date'],
            'source': {'name': 'Wikipedia player infoboxes', 'url': 'https://en.wikipedia.org/wiki/Category:Cricketers',
                       'license': 'CC BY-SA 4.0'},
            'stats': [STAT[k] for k in DECK_STATS[fmt]],
            'cards': cards,
        })

    ipl, last = ipl_stats(Names())
    cards = []
    for name in decks['IPL']:
        found = ipl[overrides.get(name, {}).get('cricsheet', name)]
        assert len(found) == 1, f'{name}: {len(found)} Cricsheet players with that display name'
        cards.append(card(name, found[0]['team'], found[0], DECK_STATS['IPL']))
    out.append({
        'format': 'IPL',
        'asOf': last,
        'source': {'name': 'Cricsheet ball-by-ball data', 'url': 'https://cricsheet.org/', 'license': 'ODC-By 1.0'},
        'stats': [STAT[k] for k in DECK_STATS['IPL']],
        'cards': cards,
    })

    for deck in out:
        cards = deck['cards']
        assert len(cards) >= DECK_SIZE, f"{deck['format']}: only {len(cards)} cards"
        assert len({c['id'] for c in cards}) == len(cards), f"{deck['format']}: duplicate players"
        lines = Counter(json.dumps(c['stats'], sort_keys=True) for c in cards)
        assert max(lines.values()) == 1, f"{deck['format']}: two cards with identical stats"
        for s in deck['stats']:
            assert len({c['stats'][s['key']] for c in cards}) > 5, f"{deck['format']}: {s['key']} barely varies"
    bare = sorted({c['name'] for deck in out for c in deck['cards'] if 'photo' not in c})
    if bare:
        print(f'{len(bare)} players without a photo in public/players/: ' + ', '.join(bare))

    json.dump(out, open(OUT, 'w'), indent=1, ensure_ascii=False)
    open(OUT, 'a').write('\n')
    print(f"wrote {OUT}: " + ', '.join(f"{d['format']} {len(d['cards'])}" for d in out))


if __name__ == '__main__':
    main()
