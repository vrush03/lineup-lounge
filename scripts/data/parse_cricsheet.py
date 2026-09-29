"""Flatten Cricsheet ball-by-ball JSON into per-match and per-player-match records.

Input:  data-raw/cricsheet/{tests,odis,t20s,ipl}/*.json   (men's matches only)
Output: data-raw/build/matches.json, data-raw/build/player_matches.json
"""
import glob
import json
import os
from collections import defaultdict

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'data-raw')
FORMATS = {'tests': 'Test', 'odis': 'ODI', 't20s': 'T20I', 'ipl': 'IPL'}
NOT_BOWLER_WICKETS = {'run out', 'retired hurt', 'retired out', 'obstructing the field', 'retired not out'}

# Franchise renames, so all-time IPL totals aggregate per franchise.
IPL_TEAM = {
    'Delhi Daredevils': 'Delhi Capitals',
    'Kings XI Punjab': 'Punjab Kings',
    'Royal Challengers Bangalore': 'Royal Challengers Bengaluru',
    'Rising Pune Supergiants': 'Rising Pune Supergiant',
}


def team_name(fmt, t):
    return IPL_TEAM.get(t, t) if fmt == 'IPL' else t


def parse_match(path, fmt):
    d = json.load(open(path))
    info = d['info']
    if info.get('gender') != 'male':
        return None, []
    reg = info['registry']['people']
    mid = os.path.basename(path)[:-5]
    teams = [team_name(fmt, t) for t in info['teams']]
    outcome = info.get('outcome', {})
    match = {
        'id': mid,
        'fmt': fmt,
        'date': info['dates'][0],
        'year': int(info['dates'][0][:4]),
        'event': info.get('event', {}).get('name'),
        'stage': info.get('event', {}).get('stage'),
        'venue': info.get('venue'),
        'city': info.get('city'),
        'teams': teams,
        'winner': team_name(fmt, outcome['winner']) if 'winner' in outcome else None,
        'result': outcome.get('result'),
        'by': outcome.get('by'),
        'pom': [reg[p] for p in info.get('player_of_match', []) if p in reg],
        'innings': [],
    }

    stats = {}  # person id -> stat dict

    def row(name, team):
        pid = reg[name]
        if pid not in stats:
            stats[pid] = {'pid': pid, 'name': name, 'team': team, 'bat_inns': [], 'balls_bowled': 0,
                          'runs_conceded': 0, 'wkts': 0, 'fours': 0, 'sixes': 0, 'catches': 0,
                          'stumpings': 0, 'best_inns_wkts': []}
        return stats[pid]

    for team, names in info['players'].items():
        for n in names:
            row(n, team_name(fmt, team))

    for inn in d['innings']:
        if inn.get('super_over'):
            continue
        bat_team = team_name(fmt, inn['team'])
        bowl_team = next((t for t in teams if t != bat_team), None)
        total = wkts_fallen = legal = 0
        bat = {}  # name -> [runs, balls, out]
        bowl = defaultdict(lambda: [0, 0, 0])  # name -> [balls, runs, wkts]
        for over in inn.get('overs', []):
            for dl in over['deliveries']:
                ex = dl.get('extras', {})
                r = dl['runs']
                total += r['total']
                b = bat.setdefault(dl['batter'], [0, 0, False])
                bat.setdefault(dl['non_striker'], [0, 0, False])
                b[0] += r['batter']
                if 'wides' not in ex:
                    b[1] += 1
                if not r.get('non_boundary'):
                    s = row(dl['batter'], bat_team)
                    if r['batter'] == 4:
                        s['fours'] += 1
                    elif r['batter'] == 6:
                        s['sixes'] += 1
                bw = bowl[dl['bowler']]
                if 'wides' not in ex and 'noballs' not in ex:
                    bw[0] += 1
                    legal += 1
                bw[1] += r['total'] - ex.get('byes', 0) - ex.get('legbyes', 0) - ex.get('penalty', 0)
                for w in dl.get('wickets', []):
                    out = bat.setdefault(w['player_out'], [0, 0, False])
                    if w['kind'] not in ('retired hurt', 'retired not out'):
                        out[2] = True
                        wkts_fallen += 1
                    if w['kind'] not in NOT_BOWLER_WICKETS:
                        bw[2] += 1
                    for f in w.get('fielders', []):
                        if f.get('substitute') or 'name' not in f or f['name'] not in reg:
                            continue
                        if w['kind'] in ('caught', 'caught and bowled'):
                            row(f['name'], bowl_team)['catches'] += 1
                        elif w['kind'] == 'stumped':
                            row(f['name'], bowl_team)['stumpings'] += 1
                    if w['kind'] == 'caught and bowled' and not w.get('fielders'):
                        row(dl['bowler'], bowl_team)['catches'] += 1
        for name, (runs, balls, out) in bat.items():
            if name in reg:
                row(name, bat_team)['bat_inns'].append([runs, balls, out])
        for name, (balls, runs, w) in bowl.items():
            if name in reg:
                s = row(name, bowl_team)
                s['balls_bowled'] += balls
                s['runs_conceded'] += runs
                s['wkts'] += w
                s['best_inns_wkts'].append([w, runs])
        match['innings'].append({'team': bat_team, 'runs': total, 'wkts': wkts_fallen, 'balls': legal,
                                 'declared': bool(inn.get('declared'))})

    rows = []
    for s in stats.values():
        s['mid'] = mid
        rows.append(s)
    return match, rows


def main():
    out = os.path.join(ROOT, 'build')
    os.makedirs(out, exist_ok=True)
    matches, rows = [], []
    for folder, fmt in FORMATS.items():
        for p in sorted(glob.glob(os.path.join(ROOT, 'cricsheet', folder, '*.json'))):
            m, r = parse_match(p, fmt)
            if m:
                matches.append(m)
                rows.extend(r)
        print(fmt, sum(1 for m in matches if m['fmt'] == fmt), 'matches')
    json.dump(matches, open(os.path.join(out, 'matches.json'), 'w'))
    json.dump(rows, open(os.path.join(out, 'player_matches.json'), 'w'))
    print(len(rows), 'player-match rows')


if __name__ == '__main__':
    main()
