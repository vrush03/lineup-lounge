"""The four hints on a Who Am I? card. Each is a title and a few facts, shown as tiles.

1. How I play: role, batting hand, bowling style.
2. My story: debut, last match, and one highlight (a final, a best innings or bowling figures,
   awards, a shirt number).
3. Who I played with: a team-mate from the card's own side and one from a different team (an IPL
   team-mate on an international card, an international team-mate on an IPL card).
4. Where I'm from: nickname, birthplace and team.

Everything is derived: the infobox rows gen_whoami.py reads, the card itself, and Cricsheet line-ups.
Cricsheet has every IPL match but only some internationals (none before 2001), so an international
count is only quoted when Cricsheet has the player's whole career in that format, and a best innings
only when it matches the highest score on the card.
"""
import json
import os
import re
from collections import Counter, defaultdict

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'data-raw')
INTL = ('Test', 'ODI', 'T20I')
PLURAL = {'Test': 'Tests', 'ODI': 'ODIs', 'T20I': 'T20Is', 'IPL': 'IPL matches'}
# Finals worth a line: the event names Cricsheet uses for the two World Cups.
WORLD_CUP = {'ODI': ({'ICC World Cup', 'ICC Cricket World Cup', 'World Cup'}, 'World Cup'),
             'T20I': ({"ICC Men's T20 World Cup", 'ICC World Twenty20'}, 'T20 World Cup')}
FULL = 0.95        # share of a card's matches Cricsheet must have before a count is quoted
REGULAR = 20       # matches together that make someone a regular team-mate
OVERLAP = 3        # years two careers must share to be called the same era


def tokens(name):
    return {t for t in re.split(r'[^a-z]+', name.lower()) if len(t) >= 3}


def listing(items):
    items = list(items)
    return items[0] if len(items) == 1 else ', '.join(items[:-1]) + ' and ' + items[-1]


def nickname(html_cell, name):
    """The first nickname in the infobox cell that doesn't give the name away, or None."""
    if not html_cell:
        return None
    cell = re.sub(r'<style.*?</style>', '', html_cell, flags=re.S)
    cell = re.sub(r'<(?:li|br|dd)[^>]*>', '|', cell)
    cell = re.sub(r'\[[^\]]*\]', '', re.sub(r'<[^>]+>', '', cell)).replace('&amp;', '&').replace('&#160;', ' ')
    mine = tokens(name)
    initials = ''.join(w[0] for w in name.split()).lower()
    for raw in re.split(r'[|,;&]', cell):
        nick = re.sub(r'\s*\([^)]*\)?', '', raw).strip(' .')
        letters = re.sub(r'[^a-z]', '', nick.lower())
        if len(letters) < 4 or letters == initials:
            continue
        # "Sanga", "Yuvi", "Azzu", "Captain Morgan": anything that starts like part of the name is a giveaway.
        if any(a[:2] == b[:2] for a in tokens(nick) | {letters} for b in mine):
            continue
        return re.sub(r'\s+', ' ', nick)
    return None


class Careers:
    """Who played which Cricsheet matches, for the players on the cards."""

    def __init__(self, names, cards, cricsheet_name):
        """cards: {player id: {'name', 'cards': {format: card}}}; cricsheet_name maps a display name to Cricsheet's."""
        self.matches = {m['id']: m for m in json.load(open(os.path.join(ROOT, 'build', 'matches.json')))}
        rows = json.load(open(os.path.join(ROOT, 'build', 'player_matches.json')))
        by_name = defaultdict(lambda: defaultdict(list))
        wanted = {cricsheet_name(p['name']) for p in cards.values()}
        display = {}
        for r in rows:
            n = display.get(r['pid'])
            if n is None:
                n = display[r['pid']] = names.info(r['pid'])['name']
            if n in wanted:
                by_name[n][r['pid']].append(r)
        self.cards = cards
        self.rows = {}      # player id -> that player's match rows
        self.country = {}   # player id -> national side
        for pid, p in cards.items():
            teams = {c['team'] for c in p['cards'].values()}
            options = by_name.get(cricsheet_name(p['name']), {})
            # Namesakes ("Rohit Sharma"): the one who played most for the teams on the cards.
            best = max(options.values(), key=lambda rs: sum(r['team'] in teams for r in rs), default=[])
            self.rows[pid] = best if any(r['team'] in teams for r in best) else []
            intl = [c['team'] for f, c in p['cards'].items() if f != 'IPL']
            seen = Counter(r['team'] for r in self.rows[pid] if self.fmt(r) in INTL)
            self.country[pid] = intl[0] if intl else (seen.most_common(1)[0][0] if seen else None)
        self.lineups = defaultdict(set)   # (match, team) -> players on the cards who were in the side
        for pid, rs in self.rows.items():
            for r in rs:
                self.lineups[(r['mid'], r['team'])].add(pid)

    def fmt(self, r):
        return self.matches[r['mid']]['fmt']

    def played(self, pid, fmt, team=None):
        return [r for r in self.rows[pid] if self.fmt(r) == fmt and (team is None or r['team'] == team)]

    def covered(self, pid, fmt):
        """Whether Cricsheet has (nearly) every match on the player's card for this format."""
        card = self.cards[pid]['cards'][fmt]
        return len(self.played(pid, fmt)) >= FULL * card['stats']['matches']

    def mates(self, pid, rows):
        """Other card players in the same side in these matches: Counter of (player id, team)."""
        mine = tokens(self.cards[pid]['name'])
        c = Counter()
        for r in rows:
            for other in self.lineups[(r['mid'], r['team'])]:
                if other != pid and not (tokens(self.cards[other]['name']) & mine):
                    c[(other, r['team'])] += 1
        return c

    def name(self, pid):
        return self.cards[pid]['name']


def fact(label, value, sub=None, **more):
    """One tile of a hint: a small label, the value, and an optional line under it."""
    return {'label': label, 'value': str(value), **({'sub': sub} if sub else {}), **more}


def style(bio):
    out = [fact('Role', bio['role']), fact('Bats', f"{bio['bats']}-handed")]
    if bio.get('bowls'):
        out.append(fact('Bowls', bio['bowls'][0].upper() + bio['bowls'][1:]))
    return out


def career(fmt, span, against, farewell, as_of):
    """Debut and last match. farewell: the opponent in the last match, when the infobox names one."""
    out = [fact(f'{fmt} debut', span[0], f'v {against}')]
    if span[1] != span[0]:
        # Someone who last played a year or two ago may not be finished, so only older careers have a "last".
        which = 'Latest' if span[1] >= as_of - 2 else 'Last'
        out.append(fact(f"{which} {'season' if fmt == 'IPL' else fmt}", span[1], f'v {farewell}' if farewell else None))
    return out


def place(m):
    return m['city'] or m['venue']


def tally(won, n):
    if n == 1:
        return 'Won' if won else 'Lost'
    if won == n:
        return 'Won both' if n == 2 else 'Won them all'
    if won == 0:
        return 'Lost both' if n == 2 else 'Lost them all'
    return f"Won {'one' if won == 1 else won}"


def finals(careers, pid, fmt, card):
    if fmt == 'IPL':
        rows = [r for r in careers.played(pid, 'IPL') if careers.matches[r['mid']]['stage'] == 'Final']
        if not rows:
            return None
        won = sum(careers.matches[r['mid']]['winner'] == r['team'] for r in rows)
        return fact('IPL finals' if len(rows) > 1 else 'IPL final', len(rows), tally(won, len(rows)))
    if fmt not in WORLD_CUP:
        return None
    events, label = WORLD_CUP[fmt]
    rows = [r for r in careers.played(pid, fmt, card['team'])
            if careers.matches[r['mid']]['stage'] == 'Final' and careers.matches[r['mid']]['event'] in events]
    if not rows:
        return None
    rows.sort(key=lambda r: careers.matches[r['mid']]['date'])
    years = [str(careers.matches[r['mid']]['year']) for r in rows]
    results = [careers.matches[r['mid']]['winner'] for r in rows]
    # A tied final has no winner in Cricsheet, so say nothing about the result.
    won = tally(sum(w == card['team'] for w in results), len(rows)) if all(results) else None
    return fact(f"{label} final{'s' if len(rows) > 1 else ''}", ', '.join(years), won)


def best_innings(careers, pid, fmt, card, bio):
    """The match of the highest score on the card, when Cricsheet has it."""
    high, not_out = card['stats']['highest'], bool(card.get('hsNotOut'))
    if bio['role'] == 'Bowler' or high < 50:
        return None
    rows = sorted(careers.played(pid, fmt), key=lambda r: careers.matches[r['mid']]['date'])
    best = max((runs for r in rows for runs, _, _ in r['bat_inns']), default=-1)
    hit = [r for r in rows for runs, _, out in r['bat_inns'] if runs == high and (not out) == not_out]
    if best != high or not hit:
        return None
    m = careers.matches[hit[0]['mid']]
    against = [t for t in m['teams'] if t != hit[0]['team']][0]
    return fact(f"The {high}{'*' if not_out else ''}", f'v {against}', f"{place(m)}, {m['year']}")


def best_bowling(careers, pid, fmt, bio):
    """Best figures in an innings, only for bowlers whose whole career in the format is in Cricsheet."""
    if bio['role'] not in ('Bowler', 'All-rounder') or not careers.covered(pid, fmt):
        return None
    spells = [(w, -runs, r) for r in careers.played(pid, fmt) for w, runs in r['best_inns_wkts']]
    if not spells:
        return None
    w, neg, r = max(spells, key=lambda s: (s[0], s[1], careers.matches[s[2]['mid']]['date']))
    if w < 4:
        return None
    m = careers.matches[r['mid']]
    against = [t for t in m['teams'] if t != r['team']][0]
    return fact('Best figures', f'{w}/{-neg}', f"v {against}, {place(m)}, {m['year']}")


def awards(careers, pid, fmt):
    if fmt != 'IPL':
        return None
    cricsheet = {r['pid'] for r in careers.rows[pid]}
    n = sum(1 for r in careers.played(pid, 'IPL') if cricsheet & set(careers.matches[r['mid']]['pom'] or []))
    return fact('Player of the match', n, 'IPL awards') if n >= 5 else None


def company(careers, pid, fmt, card, bios):
    """Team-mates: from the card's own side, then from a different team."""
    out = []
    name = careers.name
    if fmt == 'IPL':
        club = careers.mates(pid, careers.played(pid, 'IPL'))
        if club and club.most_common(1)[0][1] >= 10:
            (other, team), n = club.most_common(1)[0]
            out.append(fact('IPL team-mate', name(other), f'{n} matches together', player=other))
        intl = Counter()
        for (other, _), n in careers.mates(pid, [r for r in careers.rows[pid] if careers.fmt(r) in INTL]).items():
            intl[other] += n
        if intl and intl.most_common(1)[0][1] >= 5:
            other = intl.most_common(1)[0][0]
            out.append(fact('International team-mate', name(other), 'Away from the IPL', player=other))
        return out

    side = Counter({o: n for (o, t), n in careers.mates(pid, careers.played(pid, fmt, card['team'])).items()})
    top = side.most_common(1)
    if top and top[0][1] >= REGULAR:
        other, n = top[0]
        out.append(fact(f'{fmt} team-mate', name(other),
                        f'{n} {PLURAL[fmt]} together' if careers.covered(pid, fmt) else 'A regular in the same side', player=other))
    else:
        # Before Cricsheet's time: card players from the same side whose years in the format overlapped.
        mine, span = tokens(name(pid)), bios[pid]['span'][fmt]
        shared = []
        for other, p in careers.cards.items():
            c = p['cards'].get(fmt)
            if other == pid or not c or c['team'] != card['team'] or tokens(p['name']) & mine:
                continue
            a, b = bios[other]['span'][fmt]
            years = min(b, span[1]) - max(a, span[0])
            if years >= OVERLAP:
                shared.append((years, c['stats']['matches'], other))
        for _, _, other in sorted(shared, reverse=True)[:2]:
            out.append(fact(f'{fmt} side of my era', name(other), 'Same side, overlapping years', player=other))

    # A team-mate from another country, met at an IPL franchise.
    club = careers.mates(pid, careers.played(pid, 'IPL'))
    abroad = Counter({k: n for k, n in club.items() if careers.country[k[0]] != card['team']})
    pick = (abroad or club).most_common(1)
    if pick and pick[0][1] >= 10:
        (other, team), n = pick[0]
        out.append(fact('IPL team-mate', name(other), f'{n} matches at {team}', player=other))
    return out


def hints(careers, pid, fmt, card, bios, extras, as_of):
    """Four hints, each a title and its facts. extras: {'nick', 'shirt': {format: number}} from the infobox."""
    bio = bios[pid]
    highlight = (finals(careers, pid, fmt, card)
                 or (best_bowling(careers, pid, fmt, bio) if bio['role'] == 'Bowler' else best_innings(careers, pid, fmt, card, bio))
                 or best_bowling(careers, pid, fmt, bio)
                 or awards(careers, pid, fmt)
                 or (fact('Shirt number', extras['shirt'][fmt]) if fmt in extras['shirt'] else None))
    story = career(fmt, bio['span'][fmt], bio['debut'][fmt], bio['farewell'].get(fmt), as_of) + ([highlight] if highlight else [])
    kept = company(careers, pid, fmt, card, bios)
    year, where = bio['born']
    # Town and country are enough on a tile: 'Bloemfontein, South Africa'.
    parts = where.split(', ')
    born = fact('Born', year, where if len(parts) < 3 else f'{parts[0]}, {parts[-1]}')
    home = ([fact('Nickname', f"‘{extras['nick']}’")] if extras['nick'] else []) + ([born] if kept else []) + [
        fact('IPL side' if fmt == 'IPL' else 'Played for', card['team'], team=card['team'])]
    out = [
        {'title': 'How I play', 'facts': style(bio)},
        {'title': 'My story', 'facts': story},
        {'title': 'Who I played with', 'facts': kept} if kept else {'title': 'Where I was born', 'facts': [born]},
        {'title': 'Where I’m from' if kept else 'Who I played for', 'facts': home},
    ]
    mine = tokens(careers.name(pid))
    for h in out[:3]:
        for f in h['facts']:
            said = f"{f['label']} {f['value']} {f.get('sub', '')}"
            assert not (tokens(said) & mine), f'{careers.name(pid)} {fmt}: hint names the player: {said}'
    return out
