"""Turn Wikipedia record tables ("top 5" style) into ranking puzzles.

Each usable table becomes one puzzle: its top five rows, which the player must order.
Output: data-raw/build/wiki_puzzles.json
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from wiki_tables import tables  # noqa: E402
from names import tidy  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'data-raw')

PAGES = {
    'List_of_Test_cricket_records': ('Test', 'List of Test cricket records'),
    'List_of_One_Day_International_cricket_records': ('ODI', 'List of One Day International cricket records'),
    'List_of_Twenty20_International_records': ('T20I', 'List of Twenty20 International records'),
    'Cricket_World_Cup_records': ('World Cup', 'Cricket World Cup records'),
}

SKIP_SECTION = re.compile(r'progression|each (wicket|batting position)|^Key$|wins, losses|results summary|'
                          r'by team|against each|venues?$|hosts|squads|format|qualification|'
                          r'women|consecutive (defeats|losses)|winless|multiples', re.I)
ASC_SECTION = re.compile(r'fewest|lowest|fastest|narrowest|youngest|best (career )?(bowling )?(average|economy|strike rate)|'
                         r'best .*(average|economy)|least', re.I)
LABEL_COLS = re.compile(r'^(player|batter|batsman|bowler|name|team|batting team|teams|captain|wicket-?keeper|fielder|'
                        r'partnership|partners|players|nation)$', re.I)
SKIP_COLS = re.compile(r'^(rank|test|scorecard|ref\.?|refs?|match|odi|t20i|no\.?|#|notes?|result)$', re.I)
MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December'


FULL_MEMBERS = {'Afghanistan', 'Australia', 'Bangladesh', 'England', 'India', 'Ireland', 'New Zealand', 'Pakistan',
                'South Africa', 'Sri Lanka', 'West Indies', 'Zimbabwe'}


def clean_label(s):
    """Player/team label; multi-line cells (partnerships) become 'A & B'."""
    parts = [re.sub(r'\(\d+\*?\)', '', p) for p in s.split('|')]
    parts = [clean_name(p) for p in parts]
    label = ' & '.join(p for p in parts if p)
    return re.sub(r'\(v (.+?)\)', r'v \1', label).strip()


def clean_name(s):
    s = s.replace('|', ' ')
    s = re.sub(r'\[.*?\]', '', s)
    s = re.sub(r'[†‡*♠¶§#^+~]', '', s)
    s = re.sub(r'\((c|wk|captain)\)', '', s)
    return tidy(re.sub(r'\s+', ' ', s).strip(' ,/'))


def parse_value(text, header):
    """Return (sort_key, display) or None. Sort keys are 'bigger is further down a desc list'."""
    t = re.sub(r'\[.*?\]', '', text).replace('♠', '').replace('†', '').strip()
    h = header.lower()
    m = re.fullmatch(r'(\d+)\s*[–/-]\s*(\d+)', t)
    if m and 'figure' in h:
        w, r = int(m.group(1)), int(m.group(2))
        return w * 1000 + (999 - r), f'{w}/{r}'
    m = re.fullmatch(r'(\d[\d,]*)\s*(?:[–/-]\s*(\d+))?\s*(d|dec)?\.?(\s*\(.*\))?', t)
    if m and ('score' in h or 'aggregate' in h or 'total' in h):
        runs = int(m.group(1).replace(',', ''))
        disp = f'{runs:,}' + (f'/{m.group(2)}' if m.group(2) else '') + ('d' if m.group(3) else '')
        return runs, disp
    m = re.fullmatch(r'(\d+) years?,? (\d+) days?', t)
    if m:
        return int(m.group(1)) * 365.25 + int(m.group(2)), t
    m = re.fullmatch(r'(?:inns(?:ings)? (?:&|and) )?(\d[\d,]*) (runs?|wickets?|balls?)', t, re.I)
    if m and 'margin' in h:
        return int(m.group(1).replace(',', '')), t
    m = re.fullmatch(r'(\d[\d,]*(?:\.\d+)?)(\*)?', t)
    if m:
        v = float(m.group(1).replace(',', ''))
        disp = (f'{int(v):,}' if v.is_integer() else m.group(1)) + (m.group(2) or '')
        return v, disp
    return None


TEAM_COLS = re.compile(r'^(team|teams|country|nation|for|batting team)$', re.I)
OPP_COLS = re.compile(r'^(opponent|opposition|versus|against|vs\.?)', re.I)


def teams_in(cell):
    out = []
    for title in cell['titles']:
        m = re.fullmatch(r'(.+?) (?:national )?cricket team', title)
        if m and m.group(1) not in out:
            out.append(m.group(1))
    return out


def _join_sides(sides):
    return 'played for ' + ' & '.join(sorted(sides))


def team_of(row, header, label_j):
    """The side a row's player/team represented. Never read from an Opponent column."""
    if label_j is not None and TEAM_COLS.match(header[label_j]):
        return None  # the label is itself the team
    for j, h in enumerate(header):
        if j != label_j and TEAM_COLS.match(h):
            t = teams_in(row[j]) or [clean_name(row[j]['text'])]
            if t[0] and not re.search(r'\d|/', t[0]):
                return t[0]
    if label_j is not None and teams_in(row[label_j]):
        return sorted(teams_in(row[label_j]))[0]  # sorted: players who represented two sides get the same badge everywhere
    for j, h in enumerate(header):
        if j != label_j and not OPP_COLS.match(h) and teams_in(row[j]):
            return teams_in(row[j])[0]
    return None


def note_for(row, header, used):
    parts = []
    for j, h in enumerate(header):
        if j in used or SKIP_COLS.match(h) or j >= len(row):
            continue
        v = clean_name(row[j]['text'])
        if not v or v in parts:
            continue
        hl = h.lower()
        if hl in ('venue', 'ground'):
            v = v.split(',')[0]
        elif hl in ('opponent', 'opposition', 'versus'):
            v = 'v ' + v
        elif hl in ('innings', 'inns'):
            v = f'{v} inns'
        elif hl == 'matches':
            v = f'{v} matches'
        elif hl == 'wickets':
            v = f'{v} wkts'
        elif hl in ('won', 'lost', 'drawn'):
            v = f'{v} {hl}'
        elif hl in ('balls', 'balls faced'):
            v = f'{v} balls'
        elif hl == 'date':
            v = re.sub(rf'^\d+ ({MONTHS}) ', '', v)
        elif not re.search(r'season|period|span|year|date|wickets|won|lost|drawn', hl):
            continue
        parts.append(v)
        if len(parts) == 3:
            break
    return ' · '.join(parts)


def prompt_for(path):
    heading = path[-1] if path else ''
    ctx = ' > '.join(path[:-1]).lower()
    if 'wicket-keeping' in ctx and 'dismissal' not in heading.lower():
        heading += ' (as wicket-keeper)'
    elif 'fielding' in ctx and 'fielder' not in heading.lower():
        heading += ' (as fielder)'
    return heading


# Section headings that are ambiguous out of context (career or innings? team or player?).
# Keyed by puzzle id; reviewed by hand.
PROMPTS = {
    'w-test-most-runs-in-an-innings': 'Highest team totals in a Test innings',
    'w-test-most-dismissals-in-a-career': 'Most Test dismissals as wicket-keeper (career)',
    'w-test-best-career-strike-rate': 'Best Test bowling strike rate (career)',
    'w-odi-highest-innings-totals': 'Highest ODI team totals',
    'w-odi-highest-innings-total-batting-second': 'Highest ODI team totals batting second',
    'w-odi-highest-individual-scores': 'Highest individual ODI innings',
    'w-odi-highest-strike-rates': 'Highest ODI batting strike rate (career)',
    'w-odi-most-centuries': 'Most ODI centuries (career)',
    'w-odi-most-wickets': 'Most ODI wickets (career)',
    'w-odi-best-innings-figures': 'Best ODI bowling figures in an innings',
    'w-odi-most-dismissals': 'Most ODI dismissals as wicket-keeper (career)',
    'w-odi-most-catches': 'Most ODI catches as wicket-keeper (career)',
    'w-odi-most-stumpings': 'Most ODI stumpings (career)',
    'w-odi-most-matches-played': 'Most ODI matches played',
    'w-t20i-most-50-scores': 'Most T20I 50+ scores (career)',
    'w-t20i-most-wickets': 'Most T20I wickets (career)',
    'w-t20i-most-dismissals': 'Most T20I dismissals as wicket-keeper (career)',
    'w-t20i-most-stumpings': 'Most T20I stumpings (career)',
    'w-world-cup-highest-totals': 'Highest team totals at a World Cup',
    'w-world-cup-lowest-totals-successfully-defended': 'Lowest totals successfully defended at a World Cup',
    'w-world-cup-greatest-win-margins-by-balls-remaining': 'Biggest World Cup wins by balls to spare',
    'w-world-cup-most-runs': 'Most World Cup runs (career)',
    'w-world-cup-highest-individual-score': 'Highest individual World Cup innings',
    'w-world-cup-highest-average': 'Highest World Cup batting average (career)',
    'w-world-cup-highest-strike-rate': 'Highest World Cup batting strike rate (career)',
    'w-world-cup-most-half-centuries': 'Most World Cup half-centuries (career)',
    'w-world-cup-most-runs-in-a-single-tournament': 'Most runs in a single World Cup',
    'w-world-cup-most-wickets': 'Most World Cup wickets (career)',
    'w-world-cup-best-figures-in-an-innings': 'Best World Cup bowling figures',
    'w-world-cup-best-average': 'Best World Cup bowling average (career)',
    'w-world-cup-best-economy-rate': 'Best World Cup economy rate (career)',
    'w-world-cup-best-strike-rate': 'Best World Cup bowling strike rate (career)',
    'w-world-cup-most-career-dismissals': 'Most World Cup dismissals as wicket-keeper',
    'w-world-cup-most-catches': 'Most World Cup catches as wicket-keeper',
    'w-world-cup-most-matches-as-captain': 'Most World Cup matches as captain',
}


def puzzle_from_table(t, fmt, page_title, page_slug, revid):
    header = t['header']
    section = t['section'][-1] if t['section'] else ''
    if not header or SKIP_SECTION.search(' > '.join(t['section'])):
        return None
    label_j = next((j for j, h in enumerate(header) if LABEL_COLS.match(h)), None)
    batsman_js = [j for j, h in enumerate(header) if re.match(r'(first|second) bat', h, re.I)]
    value_j = next((j for j, h in enumerate(header) if not SKIP_COLS.match(h) and j != label_j and j not in batsman_js), None)
    if value_j is None or (label_j is None and len(batsman_js) != 2):
        return None
    vh = header[value_j]
    direction = 'asc' if ASC_SECTION.search(section) or re.search(r'fewest|lowest|youngest', vh, re.I) else 'desc'

    items, seen_keys, seen_labels = [], set(), set()
    for row in t['rows']:
        if len(row) != len(header):
            continue
        pv = parse_value(row[value_j]['text'], vh)
        if not pv:
            return None  # unparseable column: whole table unusable
        key, disp = pv
        if batsman_js:
            label = ' & '.join(clean_name(row[j]['text']) for j in batsman_js)
        else:
            label = clean_label(row[label_j]['text'])
        if re.search(r'\d', label):
            return None  # labels that embed scores read badly
        if not label or key in seen_keys:
            continue  # ties make the ordering ambiguous
        if label in seen_labels:
            yr = next((clean_name(row[j]['text']) for j, h in enumerate(header)
                       if re.search(r'season|date|year', h, re.I)), None)
            if not yr:
                continue
            yr = re.sub(rf'^\d+ ({MONTHS}) ', '', yr)
            label = f'{label} ({yr})'
            if label in seen_labels:
                continue
        used = {value_j, *( [label_j] if label_j is not None else batsman_js)}
        team = team_of(row, header, label_j)
        if label_j is not None and TEAM_COLS.match(header[label_j]):
            # team-record rows: "Sri Lanka v India" / "England (2018)" -> the team itself
            team = re.sub(r'\s*\(.*\)$', '', re.sub(r' v .*$', '', label))
        is_team_row = label_j is not None and TEAM_COLS.match(header[label_j])
        note = note_for(row, header, used)
        sides = teams_in(row[label_j]) if label_j is not None else []
        if len(sides) > 1 and not is_team_row:  # a player who represented two countries
            note = ' · '.join(filter(None, [_join_sides(sides), note]))
        items.append({'label': label, 'value': key, 'display': disp,
                      'note': note, 'team': team, 'person': not is_team_row})
        seen_keys.add(key)
        seen_labels.add(label)
        if len(items) == 5:
            break
    if len(items) < 5:
        return None
    if re.search(r'partnership', section, re.I) and not all('&' in i['label'] for i in items):
        return None
    if sum(1 for i in items if any(m in (i['team'] or '') for m in FULL_MEMBERS)) < 3:
        return None  # mostly associate-nation names: too obscure for a daily puzzle
    ordered = sorted(items, key=lambda i: i['value'], reverse=direction == 'desc')
    if [i['value'] for i in ordered] != [i['value'] for i in items]:
        return None  # table isn't a clean ranking; don't trust it
    slug = re.sub(r'[^a-z0-9]+', '-', f'{fmt} {section}'.lower()).strip('-')
    return {
        'id': f'w-{slug}',
        'prompt': PROMPTS.get(f'w-{slug}', prompt_for(t['section'])),
        'format': fmt,
        'direction': direction,
        'unit': vh.lower(),
        'items': items,
        'source': {'name': f'Wikipedia: {page_title}', 'url': f'https://en.wikipedia.org/wiki/{page_slug}?oldid={revid}',
                   'license': 'CC BY-SA 4.0'},
        # Date of the page revision we fetched. (A table's own "Last updated" note is when its
        # top five last changed; for settled records that can be years ago, which reads as stale.)
        'asOf': revision_date(page_slug),
    }


def revision_date(slug):
    revid = str(json.load(open(os.path.join(ROOT, 'wiki', f'{slug}.json')))['parse']['revid'])
    return json.load(open(os.path.join(ROOT, 'wiki', 'revision_dates.json')))[revid]


def _src(slug, title):
    revid = json.load(open(os.path.join(ROOT, 'wiki', f'{slug}.json')))['parse']['revid']
    return {'name': f'Wikipedia: {title}', 'url': f'https://en.wikipedia.org/wiki/{slug}?oldid={revid}',
            'license': 'CC BY-SA 4.0'}


def _join(names):
    names = [re.sub(r'^(Republic of|Cricket) ', '', n) for n in names]
    return names[0] if len(names) == 1 else ', '.join(names[:-1]) + ' & ' + names[-1]


def _table(slug, section):
    return next(t for t in tables(os.path.join(ROOT, 'wiki', f'{slug}.json')) if t['section'] and t['section'][-1] == section)


def tournament_lists():
    """Ranked/timeline lists from the World Cup overview pages (build.py picks five per list)."""
    lists = []
    t20, t20_title = "ICC_Men's_T20_World_Cup", "Men's T20 World Cup"
    odi, odi_title = 'Cricket_World_Cup', 'Cricket World Cup'

    finals = []
    for r in _table(t20, 'Final results')['rows']:
        year, winner, runner = r[0]['text'], clean_name(re.sub(r'\(\d+\)', '', r[1]['text'])), clean_name(r[3]['text'])
        if re.fullmatch(r'\d{4}', year) and winner:
            finals.append({'label': winner, 'value': int(year), 'display': year, 'note': f'beat {runner} in the final',
                           'team': winner, 'group': winner})
    lists.append({'id': 'wc-t20-champions', 'prompt': 'T20 World Cup champions, in order of their first title', 'format': 'T20 World Cup',
                  'kind': 'timeline', 'direction': 'asc', 'unit': 'season', 'tags': ['timeline'], 'items': finals,
                  'source': _src(t20, t20_title)})

    hosts = []
    for r in _table(t20, 'Hosts')['rows']:
        year = r[1]['text']
        names = [n.strip() for n in r[3]['text'].split('|') if n.strip()]
        if re.fullmatch(r'\d{4}', year) and int(year) <= 2026 and names:
            hosts.append({'label': _join(names), 'value': int(year), 'display': year, 'note': r[0]['text'],
                          'team': names[0], 'group': _join(names)})
    lists.append({'id': 'wc-t20-hosts', 'prompt': 'T20 World Cup hosts, in order of first time hosting', 'format': 'T20 World Cup',
                  'kind': 'timeline', 'direction': 'asc', 'unit': 'season', 'tags': ['timeline'],
                  'items': sorted(hosts, key=lambda i: i['value']), 'source': _src(t20, t20_title)})

    champs, odi_hosts = [], []
    for r in _table(odi, 'Results')['rows']:
        year = r[1]['text']
        if not re.fullmatch(r'\d{4}', year) or not r[4]['text']:
            continue  # future editions
        winner = teams_in(r[4])[0] if teams_in(r[4]) else clean_name(r[4]['text'].split('|')[0])
        runner = teams_in(r[6])[0] if teams_in(r[6]) else clean_name(r[6]['text'].split('|')[0])
        champs.append({'label': winner, 'value': int(year), 'display': year, 'note': f'beat {runner} at {r[3]["text"].split(",")[0]}',
                       'team': winner, 'group': winner})
        host = _join(r[2]['titles'] or [r[2]['text']])
        odi_hosts.append({'label': host, 'value': int(year), 'display': year, 'note': f'final at {r[3]["text"].split(",")[0]}',
                          'team': re.sub(r'^(Republic of|Cricket) ', '', (r[2]['titles'] or [host])[0]), 'group': host})
    lists.append({'id': 'wc-odi-champions', 'prompt': 'Cricket World Cup champions, in order of their first title', 'format': 'World Cup',
                  'kind': 'timeline', 'direction': 'asc', 'unit': 'season', 'tags': ['timeline'], 'items': champs,
                  'source': _src(odi, odi_title)})
    lists.append({'id': 'wc-odi-hosts', 'prompt': 'Cricket World Cup hosts, in order of first time hosting', 'format': 'World Cup',
                  'kind': 'timeline', 'direction': 'asc', 'unit': 'season', 'tags': ['timeline'], 'items': odi_hosts,
                  'source': _src(odi, odi_title)})

    ov = _table(odi, 'Overview')
    h = ov['header']
    col = {k: next(j for j, x in enumerate(h) if x.endswith(k)) for k in ('Won', 'Mat.', 'Win%*')}
    wins = []
    for r in ov['rows']:
        team = clean_name(r[0]['text'])
        if re.fullmatch(r'\d+', r[col['Won']]['text']):
            wins.append({'label': team, 'value': int(r[col['Won']]['text']), 'note': f"{r[col['Mat.']]['text']} matches · {r[col['Win%*']]['text']}% won",
                         'team': team})
    lists.append({'id': 'wc-odi-team-wins', 'prompt': 'Most Cricket World Cup matches won (by team)', 'format': 'World Cup',
                  'kind': 'team', 'direction': 'desc', 'unit': 'wins', 'tags': ['all-time'],
                  'items': sorted(wins, key=lambda i: -i['value']), 'source': _src(odi, odi_title)})
    for lst in lists:
        lst['asOf'] = revision_date(t20 if lst['format'] == 'T20 World Cup' else odi)
    return lists


def main():
    out, seen = [], set()
    for slug, (fmt, title) in PAGES.items():
        path = os.path.join(ROOT, 'wiki', f'{slug}.json')
        revid = json.load(open(path))['parse']['revid']
        n = 0
        for t in tables(path):
            p = puzzle_from_table(t, fmt, title, slug, revid)
            if p and p['id'] not in seen:
                seen.add(p['id'])
                out.append(p)
                n += 1
        print(f'{fmt}: {n} puzzles')
    unused = set(PROMPTS) - seen
    assert not unused, f'PROMPTS entries match no puzzle (renamed section?): {sorted(unused)}'
    os.makedirs(os.path.join(ROOT, 'build'), exist_ok=True)
    json.dump(out, open(os.path.join(ROOT, 'build', 'wiki_puzzles.json'), 'w'), indent=1)
    print(len(out), 'wiki puzzles')
    lists = tournament_lists()
    json.dump(lists, open(os.path.join(ROOT, 'build', 'wiki_lists.json'), 'w'), indent=1)
    print(len(lists), 'tournament lists:', ', '.join(f"{l['id']} ({len(l['items'])})" for l in lists))


if __name__ == '__main__':
    main()
