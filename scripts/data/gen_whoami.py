"""Build what Who Am I? adds to the Showdown decks: src/data/whoami.json.

Reads src/data/cards.json (never writes it) and, for every player on a card, records:
- role and batting hand, from the Wikipedia infobox pages gen_cards.py caches (whoami_overrides.json
  fills in the few infoboxes without a Role row);
- the years of their first and last match in each format they have a card for: the infobox's debut
  and last-match rows for Test, ODI and T20I, Cricsheet for the IPL;
- four hints for each of their cards, written by whoami_hints.py from the same infobox (bowling
  style, birthplace, nickname, shirt number, debut opponent) and from Cricsheet line-ups (team-mates,
  finals, best innings).

It also fixes the daily order. Day d shows a card from deck ROTATION[d % 4], and each deck is walked
in its own shuffled order, so a deck comes round again after four times its size in days. The orders
are arranged so nobody is the answer twice within GAP days, in any format, for the next HORIZON days.

Run gen_cards.py first; run this again whenever the decks change.
"""
import html
import json
import os
import random
import re
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from gen_cards import PLAYERS, ROOT, fetch, text  # noqa: E402
from names import Names  # noqa: E402
from whoami_hints import Careers, hints, nickname  # noqa: E402

HERE = os.path.dirname(__file__)
CARDS = os.path.join(HERE, '..', '..', 'src', 'data', 'cards.json')
OUT = os.path.join(HERE, '..', '..', 'src', 'data', 'whoami.json')
OVERRIDES = os.path.join(HERE, 'whoami_overrides.json')

# Same order as SHOWDOWN_FORMATS in src/lib/types.ts; whoami.test.ts checks the result against the app.
ROTATION = ['ODI', 'T20I', 'Test', 'IPL']
GAP = 14
HORIZON = 1500
SEED = 2026


def cell(page, label):
    """The HTML of one infobox row's value, or None. `label` is a regex for the row heading."""
    m = re.search(r'<th[^>]*class="infobox-label"[^>]*>(?:(?!</th>).)*?' + label + r'(?:(?!</th>).)*?</th><td[^>]*>(.*?)</td>', page, re.S)
    return m.group(1) if m else None


def row(page, label):
    """The text of one infobox row, or None."""
    raw = cell(page, label)
    return re.sub(r'\s+', ' ', text(re.sub(r'<[^>]+>', ' ', re.sub(r'<style.*?</style>', '', raw, flags=re.S)))) if raw else None


def role(raw):
    """'Wicket-keeper-batter', 'Top order Batter', 'Bowling all-rounder' -> one of four roles."""
    r = raw.lower().replace('-', ' ')
    if 'keeper' in r:
        return 'Wicketkeeper'
    if 'all' in r and 'round' in r:
        return 'All-rounder'
    if 'bowl' in r:
        return 'Bowler'
    assert 'bat' in r, f'unknown role {raw!r}'
    return 'Batter'


def year(s, what):
    m = re.search(r'\b(1[89]\d\d|20\d\d)\b', s or '')
    assert m, f'{what}: no year in {s!r}'
    return int(m.group(1))


def bowling(raw):
    """'Right arm leg break Right-arm medium' -> 'right-arm leg break': the first style listed, or None."""
    if not raw or raw.lower() == 'none':
        return None
    first = re.split(r'\s*/\s*|(?<=\w)\s+(?=(?:Right|Left|Slow)\b)', raw.strip())[0].lower()
    first = re.sub(r'\b(right|left) arm\b', r'\1-arm', first)
    first = re.sub(r'off[- ]?break|off[- ]spin', 'off break', first)
    return re.sub(r'leg[- ]break|leg[- ]spin', 'leg break', first)


def born(raw, name):
    """'( 1986-10-27 ) 27 October 1986 (age 39) Paddington , New South Wales, Australia' -> [1986, 'Paddington, New South Wales, Australia']."""
    # The date is written '27 October 1986' or 'March 1, 1980'; the place follows it and any '(age 39)'.
    m = re.search(r'\b(?:\d{1,2} [A-Z][a-z]+|[A-Z][a-z]+ \d{1,2},) (1[89]\d\d|20\d\d)\s*(?:\(age[^)]*\))?\s*(.*)$', raw or '')
    assert m, f'{name}: cannot read Born row {raw!r}'
    place = re.sub(r'\s*\([^)]*\)', '', m.group(2))
    place = re.sub(r'\s+,', ',', re.sub(r'\s+', ' ', place)).strip(' ,')
    assert place, f'{name}: no birthplace in {raw!r}'
    return [int(m.group(1)), place]


def ipl_careers(names):
    """First and last IPL season per display name, and the side the first match was against."""
    matches = {m['id']: m for m in json.load(open(os.path.join(ROOT, 'build', 'matches.json'))) if m['fmt'] == 'IPL'}
    seen = defaultdict(list)
    for r in json.load(open(os.path.join(ROOT, 'build', 'player_matches.json'))):
        if r['mid'] in matches:
            seen[r['pid']].append((matches[r['mid']]['date'], r['mid'], r['team']))
    out = defaultdict(list)
    for pid, played in seen.items():
        date, mid, team = min(played)
        against = [t for t in matches[mid]['teams'] if t != team]
        assert len(against) == 1, f'{pid}: IPL debut {mid} teams {matches[mid]["teams"]}'
        out[names.info(pid)['name']].append(
            {'span': [int(date[:4]), int(max(played)[0][:4])], 'against': against[0]})
    return out


def clashes(order):
    """Days on which the answer is someone who was the answer fewer than GAP days earlier."""
    last, bad = {}, []
    for d in range(HORIZON):
        ids = order[ROTATION[d % 4]]
        pid = ids[(d // 4) % len(ids)]
        if pid in last and d - last[pid] < GAP:
            bad.append(d)
        last[pid] = d
    return bad


def daily_order(decks):
    """Shuffle each deck, then swap cards around until no player comes up twice within GAP days."""
    rng = random.Random(SEED)
    order = {fmt: rng.sample(sorted(ids), len(ids)) for fmt, ids in decks.items()}
    bad = clashes(order)
    for _ in range(200_000):
        if not bad:
            return order
        d = rng.choice(bad)
        ids = order[ROTATION[d % 4]]
        i, j = (d // 4) % len(ids), rng.randrange(len(ids))
        ids[i], ids[j] = ids[j], ids[i]
        after = clashes(order)
        if len(after) <= len(bad):
            bad = after
        else:
            ids[i], ids[j] = ids[j], ids[i]
    raise AssertionError(f'could not space the daily order: {len(bad)} clashes left')


def main():
    decks = json.load(open(CARDS))
    spec = json.load(open(PLAYERS))['overrides']
    manual = json.load(open(OVERRIDES))['players']
    assert [d['format'] for d in decks] and sorted(d['format'] for d in decks) == sorted(ROTATION), 'unexpected decks'
    names = Names()
    ipl = ipl_careers(names)

    # bios: everything read about a player; only role, bats and span are written out beside the hints.
    bios, extras, cards = {}, {}, {}
    for deck in decks:
        fmt = deck['format']
        for c in deck['cards']:
            name, o = c['name'], manual.get(c['name'], {})
            page = fetch(spec.get(name, {}).get('wiki', name))['text']['*']
            p = bios.get(c['id'])
            if not p:
                raw = o.get('role') or row(page, 'Role')
                assert raw, f'{name}: no Role in the infobox; add one to whoami_overrides.json'
                bats = row(page, 'Batting') or ''
                assert bats.startswith(('Right', 'Left')), f'{name}: batting hand {bats!r}'
                p = bios[c['id']] = {'role': role(raw), 'bats': 'Left' if bats.startswith('Left') else 'Right',
                                     'born': born(row(page, 'Born'), name), 'bowls': bowling(row(page, 'Bowling')),
                                     'span': {}, 'debut': {}, 'farewell': {}}
                nick = o['nick'] if 'nick' in o else nickname(cell(page, 'Nickname'), name)
                extras[c['id']] = {'nick': nick, 'shirt': {}}
                cards[c['id']] = {'name': name, 'cards': {}}
            cards[c['id']]['cards'][fmt] = c
            shirt = re.match(r'\d+', row(page, rf'{fmt} shirt no') or '')
            if shirt:
                extras[c['id']]['shirt'][fmt] = int(shirt.group())
            if fmt == 'IPL':
                found = ipl[spec.get(name, {}).get('cricsheet', name)]
                assert len(found) == 1, f'{name}: {len(found)} Cricsheet players with that display name'
                span, against = found[0]['span'], found[0]['against']
            else:
                first = row(page, rf'(?:{fmt} debut|Only {fmt})')
                last = row(page, rf'(?:Last {fmt}|Only {fmt})')
                span = [year(first, f'{name} {fmt} debut'), year(last, f'{name} last {fmt}')]
                assert ' v ' in first, f'{name}: no opponent in {fmt} debut {first!r}'
                against = first.split(' v ', 1)[1].strip()
                if ' v ' in last:
                    p['farewell'][fmt] = last.split(' v ', 1)[1].strip()
            assert span[0] <= span[1], f'{name}: {fmt} span {span}'
            p['span'][fmt] = span
            p['debut'][fmt] = against

    careers = Careers(names, cards, lambda n: spec.get(n, {}).get('cricsheet', n))
    players = {pid: {'role': b['role'], 'bats': b['bats'], 'span': b['span'], 'hints': {}} for pid, b in bios.items()}
    for deck in decks:
        fmt = deck['format']
        for c in deck['cards']:
            players[c['id']]['hints'][fmt] = hints(careers, c['id'], fmt, c, bios, extras[c['id']], int(deck['asOf'][:4]))

    order = daily_order({d['format']: [c['id'] for c in d['cards']] for d in decks})
    assert not clashes(order)
    for d in decks:
        assert sorted(order[d['format']]) == sorted(c['id'] for c in d['cards'])

    json.dump({'players': dict(sorted(players.items())), 'order': {f: order[f] for f in ROTATION}},
              open(OUT, 'w'), indent=1, ensure_ascii=False)
    open(OUT, 'a').write('\n')
    print(f"wrote {OUT}: {len(players)} players, " + ', '.join(f'{f} {len(order[f])}' for f in ROTATION))


if __name__ == '__main__':
    main()
