"""Build the quiz: src/data/quiz.json.

Two sources:
- IPL questions computed from Cricsheet ball-by-ball data (data-raw/cricsheet/ipl), so they can be
  refreshed each season: runs actually run between the wickets, boundary share, dot balls, ...
- Hand-written international questions in quiz_manual.json (settled facts only).

Questions are dealt into daily sets of five (the app shows set `day % sets`): two name questions
and three ballpark numbers, at least one IPL and one international, and never two that share a topic
(so one question can't give away another's answer).
"""
import glob
import json
import os
import calendar
import random
import sys
import urllib.parse
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from names import Names  # noqa: E402

HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, '..', '..', 'data-raw')
OUT = os.path.join(HERE, '..', '..', 'src', 'data', 'quiz.json')
MANUAL = os.path.join(HERE, 'quiz_manual.json')

PITCH_KM = 22 * 0.9144 / 1000  # a run is 22 yards
SECONDS_PER_BALL = 40
DAY = 5
NAMES_PER_DAY = 2
CRICSHEET = {'name': 'Cricsheet ball-by-ball data', 'url': 'https://cricsheet.org/', 'license': 'ODC-By 1.0'}


def wiki(title):
    return {'name': f"Wikipedia: {title.replace('_', ' ')}",
            'url': 'https://en.wikipedia.org/wiki/' + urllib.parse.quote(title),
            'license': 'CC BY-SA 4.0'}


# Franchise renames, so all-time totals aggregate per franchise (same map as parse_cricsheet.py).
IPL_TEAM = {
    'Delhi Daredevils': 'Delhi Capitals',
    'Kings XI Punjab': 'Punjab Kings',
    'Royal Challengers Bangalore': 'Royal Challengers Bengaluru',
    'Rising Pune Supergiants': 'Rising Pune Supergiant',
}
DEMONYM = {'India': 'Indian', 'Australia': 'Australian', 'England': 'English', 'South Africa': 'South African',
           'New Zealand': 'New Zealand', 'West Indies': 'West Indian', 'Sri Lanka': 'Sri Lankan',
           'Pakistan': 'Pakistani', 'Afghanistan': 'Afghan', 'Bangladesh': 'Bangladeshi'}


class Stats:
    """Everything the IPL questions need, from one pass over every match (super overs left out)."""

    def __init__(self):
        self.matches = self.super_over_matches = self.runs = self.run_between = 0
        self.fours = self.sixes = self.legal = self.wides = self.hundreds = 0
        self.bat = Counter()              # pid -> runs
        self.ran = Counter()              # pid -> runs not from boundaries
        self.bat_sixes = Counter()
        self.last_over = Counter()        # pid -> runs in the 20th over
        self.last_over_sixes = Counter()
        self.dots = Counter()             # bowler -> legal balls with nothing off the bat (byes/leg byes count)
        self.wkts = Counter()
        self.sixes_conceded = Counter()
        self.pom = Counter()
        self.wins = Counter()             # franchise -> wins
        self.team_seasons = defaultdict(set)
        self.player_teams = defaultdict(set)  # pid -> franchises played for
        self.players = set()
        self.seasons = set()
        self.first_innings = defaultdict(list)  # season -> first-innings totals
        self.best_innings = None          # (runs, balls, sixes, pid, opponent, season, out)
        self.best_team = None             # (total, sixes, team, opponent, season)
        self.best_aggregate = None        # (runs, innings totals, teams, season)
        self.first_match = None           # (date, top scorer innings as best_innings)


def ipl_stats():
    s = Stats()
    team = lambda t: IPL_TEAM.get(t, t)  # noqa: E731
    files = sorted(glob.glob(os.path.join(ROOT, 'cricsheet', 'ipl', '*.json')))
    for path in files:
        d = json.load(open(path))
        info = d['info']
        reg = info['registry']['people']
        season = int(info['dates'][0][:4])
        s.matches += 1
        s.seasons.add(season)
        if any(inn.get('super_over') for inn in d['innings']):
            s.super_over_matches += 1
        if 'winner' in info.get('outcome', {}):
            s.wins[team(info['outcome']['winner'])] += 1
        for p in info.get('player_of_match', []):
            s.pom[reg[p]] += 1
        for t, squad in info['players'].items():
            s.team_seasons[team(t)].add(season)
            for p in squad:
                s.players.add(reg[p])
                s.player_teams[reg[p]].add(team(t))
        totals = []
        match_best = None
        for k, inn in enumerate(d['innings']):
            if inn.get('super_over'):
                continue
            opponent = next(x for x in info['teams'] if x != inn['team'])
            runs, balls, sixes = Counter(), Counter(), Counter()
            out = set()
            total = team_sixes = 0
            for over in inn['overs']:
                for b in over['deliveries']:
                    batter, bowler = reg[b['batter']], reg[b['bowler']]
                    r = b['runs']['batter']
                    extras = b.get('extras', {})
                    boundary = r in (4, 6) and not b['runs'].get('non_boundary')
                    total += b['runs']['total']
                    s.bat[batter] += r
                    runs[batter] += r
                    if 'wides' in extras:
                        s.wides += 1
                    else:
                        balls[batter] += 1
                    if boundary and r == 4:
                        s.fours += 1
                    elif boundary and r == 6:
                        s.sixes += 1
                        team_sixes += 1
                        sixes[batter] += 1
                        s.bat_sixes[batter] += 1
                        s.sixes_conceded[bowler] += 1
                    else:
                        s.ran[batter] += r
                        s.run_between += r
                    if over['over'] == 19:
                        s.last_over[batter] += r
                        if boundary and r == 6:
                            s.last_over_sixes[batter] += 1
                    if 'wides' not in extras and 'noballs' not in extras:
                        s.legal += 1
                        if r == 0:
                            s.dots[bowler] += 1
                    for w in b.get('wickets', []):
                        out.add(reg[w['player_out']])
                        if w['kind'] not in {'run out', 'retired hurt', 'retired out', 'obstructing the field'}:
                            s.wkts[bowler] += 1
            s.runs += total
            totals.append(total)
            s.hundreds += sum(1 for n in runs.values() if n >= 100)
            if k == 0:
                s.first_innings[season].append(total)
            if not s.best_team or total > s.best_team[0]:
                s.best_team = (total, team_sixes, team(inn['team']), team(opponent), season)
            pid, n = max(runs.items(), key=lambda kv: kv[1])
            innings = (n, balls[pid], sixes[pid], pid, opponent, season, pid in out)
            if not s.best_innings or n > s.best_innings[0]:
                s.best_innings = innings
            if not match_best or n > match_best[0]:
                match_best = innings
        if not s.best_aggregate or sum(totals) > s.best_aggregate[0]:
            s.best_aggregate = (sum(totals), totals, [team(t) for t in info['teams']], season)
        if not s.first_match or info['dates'][0] < s.first_match[0]:
            s.first_match = (info['dates'][0], match_best)
    return s


def initials(team_name):
    """'Mumbai Indians' -> 'MI', for accepted answers."""
    return ''.join(w[0] for w in team_name.split())


def top(counter):
    (pid, n), (_, second) = counter.most_common(2)
    assert n != second, 'tie for first place'
    return pid, n


def ipl_questions(names):
    s = ipl_stats()
    name = lambda pid: names.info(pid)['name']  # noqa: E731
    nationality = lambda pid: DEMONYM[names.info(pid)['country']]  # noqa: E731
    surname = lambda pid: [name(pid).split()[-1]]  # noqa: E731
    season = max(s.seasons)
    to = f'to the end of IPL {season}'
    q = []

    runs_pid, runs = top(s.bat)
    assert s.player_teams[runs_pid] == {'Royal Challengers Bengaluru'} and \
        len({y for y in s.seasons if y in s.team_seasons['Royal Challengers Bengaluru']}) == len(s.seasons), \
        'the top run-scorer no longer fits the one-franchise hint'
    q.append({'id': 'q-ipl-most-runs', 'topic': 'kohli', 'prompt': 'Who has scored the most runs in IPL history?',
              'answer': name(runs_pid), 'accept': surname(runs_pid),
              'hint': 'A batter who has played every IPL season for one franchise',
              'fact': f'{runs:,} runs ({to})'})

    km = s.ran[runs_pid] * PITCH_KM
    q.append({'id': 'q-ipl-kohli-km', 'topic': 'kohli', 'kind': 'number',
              'prompt': f'{name(runs_pid)} has {runs:,} IPL runs. Counting only the runs he actually ran (not boundaries), '
                        'how many kilometres is that at 22 yards a run?',
              'answer': round(km, 1), 'margin': round(km * 0.25), 'unit': 'km',
              'hint': f'Fewer than half of his runs were run: {s.ran[runs_pid]:,} of them',
              'fact': f'{s.ran[runs_pid]:,} runs × 22 yards ≈ {km:.0f} km, about {km / 42.195:.1f} marathons ({to})'})

    six_pid, six_n = top(s.bat_sixes)
    q.append({'id': 'q-ipl-most-sixes', 'topic': 'gayle', 'prompt': 'Who has hit the most sixes in IPL history?',
              'answer': name(six_pid), 'accept': surname(six_pid),
              'hint': f'A {nationality(six_pid)} batter: {round(600 * six_n / s.bat[six_pid])}% of his IPL runs came from sixes',
              'fact': f'{six_n} sixes ({to})'})

    fin_pid, fin = top(s.last_over)
    q.append({'id': 'q-ipl-dhoni-20th-over', 'topic': 'dhoni', 'kind': 'number',
              'prompt': f'{name(fin_pid)} is the IPL’s great finisher. How many IPL runs has he scored in the 20th over alone?',
              'answer': fin, 'margin': int(round(fin * 0.25, -1)), 'unit': 'runs',
              'hint': f'About {round(100 * fin / s.bat[fin_pid])}% of his {s.bat[fin_pid]:,} IPL runs',
              'fact': f'{fin:,} runs including {s.last_over_sixes[fin_pid]} sixes, the most by anyone in the last over ({to})'})

    q.append({'id': 'q-ipl-total-sixes', 'topic': 'ipl-totals', 'kind': 'number',
              'prompt': f'How many sixes have been hit in IPL history ({to})?',
              'answer': s.sixes, 'margin': int(round(s.sixes * 0.2, -2)), 'unit': 'sixes',
              'hint': f'About {s.sixes / s.matches:.0f} a match, over {s.matches:,} matches',
              'fact': f'{s.sixes:,} sixes in {s.matches:,} matches'})

    total_km = s.run_between * PITCH_KM
    q.append({'id': 'q-ipl-total-km', 'topic': 'ipl-totals', 'kind': 'number',
              'prompt': 'Add up every run actually run between the wickets in IPL history (not boundaries). '
                        'At 22 yards a run, how many kilometres is that?',
              'answer': round(total_km), 'margin': int(round(total_km * 0.25, -1)), 'unit': 'km',
              'hint': f'{s.run_between:,} runs were run',
              'fact': f'About {total_km:,.0f} km, 22 yards at a time ({to})'})

    share = 100 * (4 * s.fours + 6 * s.sixes) / s.runs
    q.append({'id': 'q-ipl-boundary-share', 'topic': 'ipl-totals', 'kind': 'number',
              'prompt': 'What percentage of all IPL runs have come from fours and sixes?',
              'answer': round(share, 1), 'margin': 8, 'unit': '%',
              'hint': 'More than half',
              'fact': f'{s.fours:,} fours and {s.sixes:,} sixes out of {s.runs:,} runs ({to})'})

    days = s.legal * SECONDS_PER_BALL / 86400
    q.append({'id': 'q-ipl-watch-every-ball', 'topic': 'ipl-totals', 'kind': 'number',
              'prompt': f'If each ball took {SECONDS_PER_BALL} seconds, how many days non-stop would it take to watch '
                        'every legal delivery in IPL history?',
              'answer': round(days), 'margin': round(days * 0.25), 'unit': 'days',
              'hint': f'There have been {s.legal:,} legal deliveries',
              'fact': f'{s.legal:,} balls × {SECONDS_PER_BALL} s ≈ {days:.0f} days ({to})'})

    wide_matches = s.wides / 240
    q.append({'id': 'q-ipl-wides-matches', 'topic': 'ipl-totals', 'kind': 'number',
              'prompt': 'Every wide means an extra ball. How many full IPL matches (240 legal balls) could all the wides '
                        'in IPL history fill?',
              'answer': round(wide_matches, 1), 'margin': 10, 'unit': 'matches',
              'hint': f'There have been {s.wides:,} wides',
              'fact': f'{s.wides:,} wides ≈ {wide_matches:.0f} matches of extra deliveries ({to})'})

    dot_share = 100 * sum(s.dots.values()) / s.legal
    q.append({'id': 'q-ipl-dot-ball-share', 'topic': 'ipl-totals', 'kind': 'number',
              'prompt': 'For all the big hitting, what percentage of legal IPL deliveries have been dot balls '
                        '(nothing off the bat)?',
              'answer': round(dot_share, 1), 'margin': 7, 'unit': '%',
              'hint': 'More than a quarter, fewer than half',
              'fact': f'{sum(s.dots.values()):,} of {s.legal:,} legal balls ({to})'})

    first, last = min(s.seasons), max(s.seasons)
    avg = lambda y: sum(s.first_innings[y]) / len(s.first_innings[y])  # noqa: E731
    rise = avg(last) - avg(first)
    q.append({'id': 'q-ipl-first-innings-rise', 'topic': 'ipl-totals', 'kind': 'number',
              'prompt': f'How many runs higher was the average first-innings IPL total in {last} than in {first}?',
              'answer': round(rise, 1), 'margin': 10, 'unit': 'runs',
              'hint': f'It averaged {avg(first):.0f} in {first}',
              'fact': f'{avg(first):.0f} in {first}, {avg(last):.0f} in {last}'})

    q.append({'id': 'q-ipl-hundreds', 'topic': 'ipl-totals', 'kind': 'number',
              'prompt': f'How many individual hundreds have been scored in the IPL ({to})?',
              'answer': s.hundreds, 'margin': int(round(s.hundreds * 0.2)), 'unit': 'hundreds',
              'hint': f'Fewer than one every {s.matches // s.hundreds + 1} matches',
              'fact': f'{s.hundreds} hundreds in {s.matches:,} matches'})

    q.append({'id': 'q-ipl-players', 'topic': 'ipl-totals', 'kind': 'number',
              'prompt': f'How many different players have played in the IPL ({to})?',
              'answer': len(s.players), 'margin': int(round(len(s.players) * 0.2, -1)), 'unit': 'players',
              'hint': f'Across {len(s.seasons)} seasons',
              'fact': f'{len(s.players)} players in {s.matches:,} matches'})

    dot_pid, dot_n = top(s.dots)
    q.append({'id': 'q-ipl-dot-ball-innings', 'topic': 'bhuvi', 'kind': 'number',
              'prompt': f'{name(dot_pid)} has bowled the most dot balls in the IPL: {dot_n:,}. '
                        'How many complete 20-over innings could those dots fill?',
              'answer': round(dot_n / 120, 1), 'margin': 3, 'unit': 'innings',
              'hint': 'An innings is 120 balls',
              'fact': f'{dot_n:,} dots = {dot_n // 6} overs without a run off the bat ({to})'})

    q.append({'id': 'q-ipl-super-overs', 'topic': 'super-overs', 'kind': 'number',
              'prompt': f'How many IPL matches have gone to a Super Over ({to})?',
              'answer': s.super_over_matches, 'margin': 4, 'unit': 'matches',
              'hint': f'Fewer than one a season, across {len(s.seasons)} seasons',
              'fact': f'{s.super_over_matches} of {s.matches:,} matches'})
    assert s.super_over_matches < len(s.seasons), 'the super-over hint no longer holds'

    wkt_pid, wkt_n = top(s.wkts)
    q.append({'id': 'q-ipl-most-wickets', 'topic': 'chahal', 'prompt': 'Who has taken the most wickets in IPL history?',
              'answer': name(wkt_pid), 'accept': surname(wkt_pid),
              'hint': 'An Indian leg-spinner who has also represented India at chess',
              'fact': f'{wkt_n} wickets ({to})'})

    conc_pid, conc_n = top(s.sixes_conceded)
    q.append({'id': 'q-ipl-most-sixes-conceded', 'topic': 'chahal',
              'prompt': 'Which bowler has been hit for the most sixes in IPL history?',
              'answer': name(conc_pid), 'accept': surname(conc_pid),
              'hint': 'A spinner who has also taken more IPL wickets than anyone'
              if conc_pid == wkt_pid else f'A {nationality(conc_pid)} bowler',
              'fact': f'{conc_n} sixes conceded ({to})'})

    pom_pid, pom_n = top(s.pom)
    q.append({'id': 'q-ipl-most-pom', 'topic': 'abd', 'prompt': 'Who has won the most Player of the Match awards in the IPL?',
              'answer': name(pom_pid), 'accept': surname(pom_pid),
              'hint': f'A {nationality(pom_pid)} batter who played for {len(s.player_teams[pom_pid])} franchises',
              'fact': f'{pom_n} awards ({to})'})

    win_team, win_n = top(s.wins)
    every = [t for t, ys in s.team_seasons.items() if s.seasons <= ys]
    q.append({'id': 'q-ipl-most-wins', 'topic': 'franchise-wins',
              'prompt': 'Which franchise has won the most IPL matches?',
              'answer': win_team, 'accept': [initials(win_team)],
              'hint': 'One of the franchises that has played every season' if win_team in every
              else 'A franchise that has missed at least one season',
              'fact': f'{win_n} wins ({to})'})

    date, (fm_runs, fm_balls, fm_sixes, fm_pid, fm_opp, _, fm_out) = s.first_match
    when = f'{int(date[8:])} {calendar.month_name[int(date[5:7])]} {date[:4]}'
    q.append({'id': 'q-ipl-first-match-hero', 'topic': 'mccullum',
              'prompt': f'Who scored {fm_runs} not out in the very first IPL match, in {date[:4]}?',
              'answer': name(fm_pid), 'accept': surname(fm_pid),
              'hint': f'A {nationality(fm_pid)} batter, playing against {fm_opp}',
              'fact': f'{fm_runs}* off {fm_balls} balls, with {fm_sixes} sixes, {when}'})
    q.append({'id': 'q-ipl-first-match-sixes', 'topic': 'mccullum', 'kind': 'number',
              'prompt': f'{name(fm_pid)} made {fm_runs} not out in the very first IPL match. How many sixes did he hit?',
              'answer': fm_sixes, 'margin': 3, 'unit': 'sixes',
              'hint': f'It took him {fm_balls} balls',
              'fact': f'{fm_sixes} sixes in {fm_runs} off {fm_balls} balls, {when}'})

    bt_total, bt_sixes, bt_team, bt_opp, bt_season = s.best_team
    q.append({'id': 'q-ipl-highest-total-sixes', 'topic': 'highest-total', 'kind': 'number',
              'prompt': f'{bt_team} made {bt_total}, the highest IPL team total, against {bt_opp} in {bt_season}. '
                        'How many sixes did they hit?',
              'answer': bt_sixes, 'margin': 5, 'unit': 'sixes',
              'hint': f'Sixes made up about {round(100 * 6 * bt_sixes / bt_total, -1):.0f}% of their runs',
              'fact': f'{bt_sixes} sixes in {bt_total} ({bt_season})'})

    agg, agg_totals, agg_teams, agg_season = s.best_aggregate
    q.append({'id': 'q-ipl-highest-aggregate', 'topic': 'highest-total', 'kind': 'number',
              'prompt': 'What is the most runs scored in a single IPL match, by both sides together?',
              'answer': agg, 'margin': 60, 'unit': 'runs',
              'hint': 'Both sides passed 250',
              'fact': f'{agg} runs: {agg_teams[0]} v {agg_teams[1]}, {agg_season}'})

    bi_runs, bi_balls, bi_sixes, bi_pid, bi_opp, bi_season, bi_out = s.best_innings
    q.append({'id': 'q-ipl-highest-score-opponent', 'topic': 'gayle',
              'prompt': f'{name(bi_pid)}’s {bi_runs} not out in {bi_season} is the highest IPL score. Which team was it against?',
              'answer': bi_opp, 'accept': [bi_opp + ' India', initials(bi_opp + ' India')],
              'hint': f'A franchise that only played {len(s.team_seasons[bi_opp])} seasons',
              'fact': f'{bi_runs}* off {bi_balls} balls with {bi_sixes} sixes'})

    for x in q:
        x.update(format='IPL', source=CRICSHEET)
    # Fail loudly if the data moves under a hand-written hint or prompt.
    assert name(wkt_pid) == 'Yuzvendra Chahal', 'IPL wicket leader changed: update the chess hint'
    assert not bi_out and not fm_out, 'the "not out" prompts no longer hold'
    assert min(len(s.first_innings[y]) for y in s.seasons) > 40, 'a season is missing matches'
    assert min(agg_totals) > 250, 'the aggregate hint no longer holds'
    return q


def topics(q):
    """A question's topics: one name, or a list when it mentions more than one subject."""
    return q['topic'] if isinstance(q['topic'], list) else [q['topic']]


def leaks(day):
    """Name answers that another question in the day gives away: in its prompt or hint, or in the fact of a
    question shown earlier."""
    found = []
    for i, q in enumerate(day):
        if q.get('kind') == 'number':
            continue
        answers = [a.lower() for a in [q['answer'], *q.get('accept', [])] if len(a) >= 4]
        for j, other in enumerate(day):
            seen = [other['prompt'], other['hint']] + ([other.get('fact', '')] if j < i else [])
            if j != i and any(a in text.lower() for a in answers for text in seen):
                found.append((q['id'], other['id']))
    return found


def deal(questions, seed='quiz'):
    """Order questions into days of five; see the module docstring for the rules."""
    assert len(questions) % DAY == 0, f'{len(questions)} questions: need a multiple of {DAY} (whole days)'
    n_days = len(questions) // DAY
    by_kind = {k: [q for q in questions if (q.get('kind') == 'number') == (k == 'number')] for k in ('name', 'number')}
    assert len(by_kind['name']) == NAMES_PER_DAY * n_days, \
        f"{len(by_kind['name'])} name questions: need {NAMES_PER_DAY} per day ({NAMES_PER_DAY * n_days})"
    rng = random.Random(seed)
    for _ in range(20000):
        names, numbers = by_kind['name'][:], by_kind['number'][:]
        rng.shuffle(names)
        rng.shuffle(numbers)
        days = [names[i * NAMES_PER_DAY:(i + 1) * NAMES_PER_DAY] + numbers[i * (DAY - NAMES_PER_DAY):(i + 1) * (DAY - NAMES_PER_DAY)]
                for i in range(n_days)]
        if all(len({t for q in d for t in topics(q)}) == sum(len(topics(q)) for q in d) and
               any(q['format'] == 'IPL' for q in d) and any(q['format'] != 'IPL' for q in d) for d in days):
            # Warm up with a name, then alternate: name, number, name, number, number.
            days = [[d[0], d[2], d[1], d[3], d[4]] for d in days]
            if not any(leaks(d) for d in days):
                return [q for d in days for q in d]
    raise SystemExit('could not deal the questions into valid days: add questions or loosen topics')


def main():
    manual = json.load(open(MANUAL))['questions']
    for q in manual:
        q['source'] = wiki(q['source'][len('wiki:'):])
    questions = deal(manual + ipl_questions(Names()))
    ids = [q['id'] for q in questions]
    assert len(set(ids)) == len(ids), 'duplicate ids'
    for q in questions:
        del q['topic']
    json.dump(questions, open(OUT, 'w'), indent=1, ensure_ascii=False)
    print(f'{len(questions)} questions ({len(questions) // DAY} days) -> {os.path.relpath(OUT)}')


if __name__ == '__main__':
    main()
