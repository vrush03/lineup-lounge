"""Generate IPL ranking puzzles from Cricsheet ball-by-ball data (complete 2008-present).

Output: data-raw/build/ipl_lists.json — ranked candidate lists; build.py picks five items from each.
"""
import json
import os
import re
from collections import Counter, defaultdict

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'data-raw')

ACTIVE = ['Chennai Super Kings', 'Mumbai Indians', 'Royal Challengers Bengaluru', 'Kolkata Knight Riders',
          'Sunrisers Hyderabad', 'Rajasthan Royals', 'Delhi Capitals', 'Punjab Kings', 'Lucknow Super Giants',
          'Gujarat Titans']
SHORT = {'Chennai Super Kings': 'CSK', 'Mumbai Indians': 'MI', 'Royal Challengers Bengaluru': 'RCB',
         'Kolkata Knight Riders': 'KKR', 'Sunrisers Hyderabad': 'SRH', 'Rajasthan Royals': 'RR',
         'Delhi Capitals': 'DC', 'Punjab Kings': 'PBKS', 'Lucknow Super Giants': 'LSG', 'Gujarat Titans': 'GT',
         'Deccan Chargers': 'Deccan', 'Rising Pune Supergiant': 'RPS', 'Pune Warriors': 'PWI',
         'Gujarat Lions': 'GL', 'Kochi Tuskers Kerala': 'Kochi'}


def venue_name(v):
    v = re.sub(r',\s*[^,]+$', '', v)  # "Wankhede Stadium, Mumbai" -> "Wankhede Stadium"
    return {'M.Chinnaswamy Stadium': 'M Chinnaswamy Stadium', 'Feroz Shah Kotla': 'Arun Jaitley Stadium',
            'Punjab Cricket Association IS Bindra Stadium': 'PCA Stadium, Mohali',
            'Punjab Cricket Association Stadium': 'PCA Stadium, Mohali',
            'MA Chidambaram Stadium': 'MA Chidambaram Stadium (Chepauk)',
            'Rajiv Gandhi International Stadium': 'Rajiv Gandhi Intl Stadium',
            'Sawai Mansingh Stadium': 'Sawai Mansingh Stadium'}.get(v, v)


def load():
    matches = {m['id']: m for m in json.load(open(os.path.join(ROOT, 'build', 'matches.json'))) if m['fmt'] == 'IPL'}
    rows = [r for r in json.load(open(os.path.join(ROOT, 'build', 'player_matches.json'))) if r['mid'] in matches]
    for m in matches.values():
        m['venue_n'] = venue_name(m['venue'])
    return matches, rows


def season_label(y):
    return f'IPL {y}'


class Agg:
    """Per-player aggregates over a subset of player-match rows."""

    def __init__(self, rows, matches, pom_filter=None):
        self.s = defaultdict(lambda: Counter())
        self.teams = defaultdict(Counter)
        for r in rows:
            a = self.s[r['pid']]
            a['matches'] += 1
            self.teams[r['pid']][r['team']] += 1
            for runs, balls, out in r['bat_inns']:
                a['inns'] += 1
                a['runs'] += runs
                a['balls'] += balls
                a['outs'] += out
                a['hundreds'] += runs >= 100
                a['fifties'] += 50 <= runs < 100
                a['ducks'] += runs == 0 and out
            for k in ('wkts', 'fours', 'sixes', 'catches', 'stumpings', 'balls_bowled', 'runs_conceded'):
                a[k] += r[k]
            a['four_fers'] += sum(1 for w, _ in r['best_inns_wkts'] if w >= 4)
        for m in matches:
            for pid in m['pom']:
                self.s[pid]['pom'] += 1

    def team(self, pid):
        return self.teams[pid].most_common(1)[0][0] if self.teams[pid] else None

    def ranked(self, metric, qualify=None, reverse=True):
        vals = []
        for pid, a in self.s.items():
            if qualify and not qualify(a):
                continue
            v = metric(a)
            if v:
                vals.append((pid, v))
        return sorted(vals, key=lambda x: -x[1] if reverse else x[1])


def sr(a):
    return round(100 * a['runs'] / a['balls'], 2) if a['balls'] else 0


def econ(a):
    return round(6 * a['runs_conceded'] / a['balls_bowled'], 2) if a['balls_bowled'] else 0


def avg(a):
    return round(a['runs'] / a['outs'], 2) if a['outs'] else 0


# metric key -> (value fn, unit, note fn, prompt noun)
METRICS = {
    'runs': (lambda a: a['runs'], 'runs', lambda a: f"{a['inns']} inns · SR {sr(a):.1f}", 'runs'),
    'wkts': (lambda a: a['wkts'], 'wickets', lambda a: f"{a['matches']} matches · econ {econ(a):.2f}", 'wickets'),
    'sixes': (lambda a: a['sixes'], 'sixes', lambda a: f"{a['runs']:,} runs · {a['inns']} inns", 'sixes'),
    'fours': (lambda a: a['fours'], 'fours', lambda a: f"{a['runs']:,} runs · {a['inns']} inns", 'fours'),
    'hundreds': (lambda a: a['hundreds'], 'hundreds', lambda a: f"{a['runs']:,} runs · {a['inns']} inns", 'hundreds'),
    'fifties': (lambda a: a['fifties'], 'fifties', lambda a: f"{a['runs']:,} runs · {a['inns']} inns", 'fifties (50–99)'),
    'ducks': (lambda a: a['ducks'], 'ducks', lambda a: f"{a['inns']} inns", 'ducks'),
    'catches': (lambda a: a['catches'], 'catches', lambda a: f"{a['matches']} matches", 'catches'),
    'stumpings': (lambda a: a['stumpings'], 'stumpings', lambda a: f"{a['matches']} matches", 'stumpings'),
    'pom': (lambda a: a['pom'], 'awards', lambda a: f"{a['matches']} matches", 'Player of the Match awards'),
    'matches': (lambda a: a['matches'], 'matches', lambda a: f"{a['runs']:,} runs · {a['wkts']} wkts", 'matches played'),
    'four_fers': (lambda a: a['four_fers'], '4-wicket hauls', lambda a: f"{a['wkts']} wkts · {a['matches']} matches",
                  '4-wicket hauls'),
}


def player_list(lid, prompt, agg, metric, *, qualify=None, reverse=True, value_fn=None, unit=None, note_fn=None,
                tags=(), display=None):
    fn, u, nf, _ = METRICS.get(metric, (None, None, None, None))
    fn = value_fn or fn
    ranked = agg.ranked(fn, qualify, reverse)
    return {
        'id': lid, 'prompt': prompt, 'direction': 'desc' if reverse else 'asc', 'unit': unit or u,
        'kind': 'player', 'tags': list(tags),
        'items': [{'pid': pid, 'value': v, 'display': display(v) if display else None,
                   'note': (note_fn or nf)(agg.s[pid]), 'team': agg.team(pid)} for pid, v in ranked[:25]],
    }


def main():
    matches, rows = load()
    by_mid = defaultdict(list)
    for r in rows:
        by_mid[r['mid']].append(r)
    ms = list(matches.values())
    years = sorted({m['year'] for m in ms})
    lists = []

    def agg_for(pred):
        sel = [m for m in ms if pred(m)]
        return Agg([r for m in sel for r in by_mid[m['id']]], sel)

    # All-time
    allt = agg_for(lambda m: True)
    for metric, noun in [('runs', 'runs'), ('wkts', 'wickets'), ('sixes', 'sixes'), ('fours', 'fours'),
                         ('hundreds', 'hundreds'), ('fifties', 'fifties (50–99 scores)'), ('ducks', 'ducks'),
                         ('catches', 'catches'), ('stumpings', 'stumpings'), ('pom', 'Player of the Match awards'),
                         ('four_fers', '4-wicket hauls')]:
        lists.append(player_list(f'ipl-all-{metric}', f'Most IPL {noun} (all-time)', allt, metric, tags=['all-time']))
    lists.append(player_list('ipl-all-sr', 'Highest IPL career strike rate (min. 1,000 balls faced)', allt, 'sr',
                             value_fn=sr, qualify=lambda a: a['balls'] >= 1000, unit='strike rate',
                             note_fn=lambda a: f"{a['runs']:,} runs off {a['balls']:,} balls", tags=['all-time'],
                             display=lambda v: f'{v:.2f}'))
    lists.append(player_list('ipl-all-econ', 'Best IPL career economy rate (min. 1,200 balls bowled)', allt, 'econ',
                             value_fn=econ, qualify=lambda a: a['balls_bowled'] >= 1200, reverse=False,
                             unit='runs per over', note_fn=lambda a: f"{a['wkts']} wkts · {a['balls_bowled'] // 6} overs",
                             tags=['all-time'], display=lambda v: f'{v:.2f}'))
    lists.append(player_list('ipl-all-avg', 'Highest IPL career batting average (min. 1,500 runs)', allt, 'avg',
                             value_fn=avg, qualify=lambda a: a['runs'] >= 1500, unit='average',
                             note_fn=lambda a: f"{a['runs']:,} runs · {a['inns']} inns", tags=['all-time'],
                             display=lambda v: f'{v:.2f}'))

    # Each season
    for y in years:
        ag = agg_for(lambda m: m['year'] == y)
        for metric, noun in [('runs', 'runs'), ('wkts', 'wickets'), ('sixes', 'sixes')]:
            lists.append(player_list(f'ipl-{y}-{metric}', f'Most {noun} in IPL {y}', ag, metric,
                                     tags=['season', str(y)]))

    # For each active franchise
    for team in ACTIVE:
        ag = Agg([r for r in rows if r['team'] == team], [])
        for metric, noun in [('runs', 'runs'), ('wkts', 'wickets'), ('sixes', 'sixes')]:
            lists.append(player_list(f'ipl-for-{SHORT[team].lower()}-{metric}', f'Most IPL {noun} for {team}', ag,
                                     metric, tags=['franchise', team]))
    # Against each active franchise
    for team in ACTIVE:
        ag = Agg([r for r in rows if r['team'] != team and team in matches[r['mid']]['teams']], [])
        for metric, noun in [('runs', 'runs'), ('wkts', 'wickets')]:
            lists.append(player_list(f'ipl-vs-{SHORT[team].lower()}-{metric}', f'Most IPL {noun} against {team}', ag,
                                     metric, tags=['franchise', team]))

    # Big venues
    venues = Counter(m['venue_n'] for m in ms)
    for v, n in venues.most_common(8):
        ag = agg_for(lambda m: m['venue_n'] == v)
        for metric, noun in [('runs', 'runs'), ('wkts', 'wickets'), ('sixes', 'sixes')]:
            slug = re.sub(r'[^a-z0-9]+', '-', v.lower()).strip('-')
            lists.append(player_list(f'ipl-at-{slug}-{metric}', f'Most IPL {noun} at {v}', ag, metric,
                                     tags=['venue', v]))

    # Playoffs
    po = agg_for(lambda m: m['stage'] is not None)
    for metric, noun in [('runs', 'runs'), ('wkts', 'wickets')]:
        lists.append(player_list(f'ipl-playoffs-{metric}', f'Most {noun} in IPL playoff matches', po, metric,
                                 tags=['playoffs']))

    # Single-innings bests (each player's best, so labels stay unique)
    def best_per_player(key_fn, fmt_fn, note_fn):
        best = {}
        for r in rows:
            m = matches[r['mid']]
            for k in key_fn(r):
                if k is not None and (r['pid'] not in best or k > best[r['pid']][0]):
                    best[r['pid']] = (k, r, m)
        out = sorted(best.items(), key=lambda x: -x[1][0])[:25]
        return [{'pid': pid, 'value': k, 'display': fmt_fn(k, r), 'note': note_fn(r, m), 'team': r['team']}
                for pid, (k, r, m) in out]

    def opp(r, m):
        return next((t for t in m['teams'] if t != r['team']), '')

    lists.append({'id': 'ipl-best-score', 'prompt': 'Highest individual IPL scores (each player’s best)',
                  'direction': 'desc', 'unit': 'runs', 'kind': 'player', 'tags': ['records'],
                  'items': best_per_player(
                      lambda r: [i[0] + (0.5 if not i[2] else 0) for i in r['bat_inns']],
                      lambda k, r: f'{int(k)}{"*" if k % 1 else ""}',
                      lambda r, m: f"v {SHORT.get(opp(r, m), opp(r, m))} · {m['year']}")})
    lists.append({'id': 'ipl-best-figures', 'prompt': 'Best IPL bowling figures (each player’s best)',
                  'direction': 'desc', 'unit': 'figures', 'kind': 'player', 'tags': ['records'],
                  'items': best_per_player(
                      lambda r: [w * 1000 + (999 - rc) for w, rc in r['best_inns_wkts'] if w >= 4],
                      lambda k, r: f'{int(k // 1000)}/{999 - int(k % 1000)}',
                      lambda r, m: f"v {SHORT.get(opp(r, m), opp(r, m))} · {m['year']}")})
    lists.append({'id': 'ipl-best-sixes-inns', 'prompt': 'Most sixes in an IPL innings (each player’s best)',
                  'direction': 'desc', 'unit': 'sixes', 'kind': 'player', 'tags': ['records'],
                  'items': best_per_player(
                      lambda r: [r['sixes']] if r['bat_inns'] else [],
                      lambda k, r: f'{k}',
                      lambda r, m: f"{r['bat_inns'][0][0]} runs v {SHORT.get(opp(r, m), opp(r, m))} · {m['year']}")})

    # Team records: each franchise's highest / lowest completed total
    best_tot, low_tot = {}, {}
    for m in ms:
        for inn in m['innings']:
            t = inn['team']
            opp_t = next((x for x in m['teams'] if x != t), '')
            item = (inn['runs'], f"{inn['runs']}/{inn['wkts']}", f"v {SHORT.get(opp_t, opp_t)} · {m['year']}")
            if t not in best_tot or inn['runs'] > best_tot[t][0]:
                best_tot[t] = item
            if inn['wkts'] == 10 and (t not in low_tot or inn['runs'] < low_tot[t][0]):
                low_tot[t] = item
    for lid, prompt, src, rev in [('ipl-team-high', 'Highest IPL team totals (each franchise’s best)', best_tot, True),
                                  ('ipl-team-low', 'Lowest all-out IPL totals (each franchise’s worst)', low_tot, False)]:
        items = sorted(({'label': t, 'value': v, 'display': d, 'note': n, 'team': t}
                        for t, (v, d, n) in src.items() if t in ACTIVE), key=lambda i: -i['value'] if rev else i['value'])
        lists.append({'id': lid, 'prompt': prompt, 'direction': 'desc' if rev else 'asc', 'unit': 'runs',
                      'kind': 'team', 'tags': ['records'], 'items': items})

    # Franchise wins all-time
    wins, played = Counter(), Counter()
    for m in ms:
        for t in m['teams']:
            played[t] += 1
        if m['winner']:
            wins[m['winner']] += 1
    lists.append({'id': 'ipl-team-wins', 'prompt': 'Most IPL matches won (all-time, by franchise)', 'direction': 'desc',
                  'unit': 'wins', 'kind': 'team', 'tags': ['all-time'],
                  'items': sorted(({'label': t, 'value': wins[t], 'note': f'{played[t]} matches played', 'team': t}
                                   for t in ACTIVE), key=lambda i: -i['value'])})
    lists.append({'id': 'ipl-team-winpct', 'prompt': 'Best IPL win percentage (all-time, by franchise)',
                  'direction': 'desc', 'unit': '% won', 'kind': 'team', 'tags': ['all-time'],
                  'items': sorted(({'label': t, 'value': round(100 * wins[t] / played[t], 1),
                                    'display': f'{100 * wins[t] / played[t]:.1f}%',
                                    'note': f'{wins[t]} wins in {played[t]} matches', 'team': t}
                                   for t in ACTIVE), key=lambda i: -i['value'])})

    # Timelines: champions and Orange/Purple Cap winners, ordered by season
    finals = {m['year']: m for m in ms if m['stage'] == 'Final'}
    champs = {y: finals[y]['winner'] for y in years if y in finals and finals[y]['winner']}
    caps = {}
    for y in years:
        ag = agg_for(lambda m: m['year'] == y)
        caps[y] = (ag.ranked(METRICS['runs'][0])[0], ag.ranked(METRICS['wkts'][0])[0], ag)
    lists.append({'id': 'ipl-timeline-champions', 'prompt': 'IPL champions, in order of their first title',
                  'direction': 'asc', 'unit': 'season', 'kind': 'timeline', 'tags': ['timeline'],
                  'items': [{'label': t, 'value': y, 'display': str(y), 'note': f'beat {SHORT.get(o, o)} in the final',
                             'team': t, 'group': t}
                            for y, t in sorted(champs.items())
                            for o in [next(x for x in finals[y]['teams'] if x != t)]]})
    lists.append({'id': 'ipl-timeline-orange-cap', 'prompt': 'Orange Cap winners (most runs in a season), in order of their first cap',
                  'direction': 'asc', 'unit': 'season', 'kind': 'timeline', 'tags': ['timeline'],
                  'items': [{'pid': pid, 'value': y, 'display': str(y), 'note': f'{v} runs for {SHORT.get(ag.team(pid))}',
                             'team': ag.team(pid), 'group': pid}
                            for y, ((pid, v), _, ag) in sorted(caps.items())]})
    lists.append({'id': 'ipl-timeline-purple-cap', 'prompt': 'Purple Cap winners (most wickets in a season), in order of their first cap',
                  'direction': 'asc', 'unit': 'season', 'kind': 'timeline', 'tags': ['timeline'],
                  'items': [{'pid': pid, 'value': y, 'display': str(y), 'note': f'{v} wickets for {SHORT.get(ag.team(pid))}',
                             'team': ag.team(pid), 'group': pid}
                            for y, (_, (pid, v), ag) in sorted(caps.items())]})

    for lst in lists:
        lst['format'] = 'IPL'
        lst['source'] = {'name': 'Cricsheet ball-by-ball data', 'url': 'https://cricsheet.org/',
                         'license': 'ODC-By 1.0'}
        lst['asOf'] = max(m['date'] for m in ms)
    json.dump(lists, open(os.path.join(ROOT, 'build', 'ipl_lists.json'), 'w'))
    print(len(lists), 'IPL lists; last match', max(m['date'] for m in ms))


if __name__ == '__main__':
    main()
