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
import random
import sys
import urllib.parse
from collections import Counter

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


def ipl_totals():
    """One pass over every IPL match; super overs are left out."""
    t = {'matches': 0, 'super_over_matches': 0, 'runs': 0, 'run_between': 0, 'fours': 0, 'sixes': 0,
         'legal': 0, 'last_season': 0}
    bat = Counter()        # pid -> runs
    ran = Counter()        # pid -> runs not from boundaries
    sixes = Counter()
    last_over = Counter()  # pid -> runs in the 20th over
    last_over_sixes = Counter()
    dots = Counter()       # bowler pid -> legal balls with no runs off the bat (byes/leg byes count as dots)
    wkts = Counter()
    best = (0, None, None)  # highest innings: (runs, pid, opponent)
    for path in sorted(glob.glob(os.path.join(ROOT, 'cricsheet', 'ipl', '*.json'))):
        d = json.load(open(path))
        info = d['info']
        reg = info['registry']['people']
        t['matches'] += 1
        t['last_season'] = max(t['last_season'], int(info['dates'][0][:4]))
        if any(inn.get('super_over') for inn in d['innings']):
            t['super_over_matches'] += 1
        for inn in d['innings']:
            if inn.get('super_over'):
                continue
            innings = Counter()
            for over in inn['overs']:
                for b in over['deliveries']:
                    batter, bowler = reg[b['batter']], reg[b['bowler']]
                    r = b['runs']['batter']
                    extras = b.get('extras', {})
                    boundary = r in (4, 6) and not b['runs'].get('non_boundary')
                    t['runs'] += b['runs']['total']
                    bat[batter] += r
                    innings[batter] += r
                    if boundary:
                        t['fours' if r == 4 else 'sixes'] += 1
                        if r == 6:
                            sixes[batter] += 1
                    else:
                        ran[batter] += r
                        t['run_between'] += r
                    if over['over'] == 19:
                        last_over[batter] += r
                        if boundary and r == 6:
                            last_over_sixes[batter] += 1
                    if 'wides' not in extras and 'noballs' not in extras:
                        t['legal'] += 1
                        if r == 0:
                            dots[bowler] += 1
                    for w in b.get('wickets', []):
                        if w['kind'] not in {'run out', 'retired hurt', 'retired out', 'obstructing the field'}:
                            wkts[bowler] += 1
            pid, n = max(innings.items(), key=lambda kv: kv[1])
            if n > best[0]:
                best = (n, pid, next(x for x in info['teams'] if x != inn['team']))
    t['best'] = best
    return t, bat, ran, sixes, last_over, last_over_sixes, dots, wkts


def top(counter):
    (pid, n), (_, second) = counter.most_common(2)
    assert n != second, 'tie for first place'
    return pid, n


def ipl_questions(names):
    t, bat, ran, sixes, last_over, last_over_sixes, dots, wkts = ipl_totals()
    name = lambda pid: names.info(pid)['name']  # noqa: E731
    season = t['last_season']
    to = f'to the end of IPL {season}'
    q = []

    runs_pid, runs = top(bat)
    q.append({'id': 'q-ipl-most-runs', 'topic': 'kohli', 'prompt': 'Who has scored the most runs in IPL history?',
              'answer': name(runs_pid), 'accept': [name(runs_pid).split()[-1]],
              'hint': 'A batter who has played every IPL season for one franchise',
              'fact': f'{runs:,} runs ({to})'})

    km = ran[runs_pid] * PITCH_KM
    q.append({'id': 'q-ipl-kohli-km', 'topic': 'kohli', 'kind': 'number',
              'prompt': f'{name(runs_pid)} has {runs:,} IPL runs. Counting only the runs he actually ran (not boundaries), '
                        'how many kilometres is that at 22 yards a run?',
              'answer': round(km, 1), 'margin': round(km * 0.25), 'unit': 'km',
              'hint': f'Fewer than half of his runs were run: {ran[runs_pid]:,} of them',
              'fact': f'{ran[runs_pid]:,} runs × 22 yards ≈ {km:.0f} km, about {km / 42.195:.1f} marathons ({to})'})

    six_pid, six_n = top(sixes)
    q.append({'id': 'q-ipl-most-sixes', 'topic': 'gayle', 'prompt': 'Who has hit the most sixes in IPL history?',
              'answer': name(six_pid), 'accept': [name(six_pid).split()[-1]],
              'hint': 'A West Indian opener who called himself the Universe Boss',
              'fact': f'{six_n} sixes ({to})'})

    fin_pid, fin = top(last_over)
    q.append({'id': 'q-ipl-dhoni-20th-over', 'topic': 'dhoni', 'kind': 'number',
              'prompt': f'{name(fin_pid)} is the IPL’s great finisher. How many IPL runs has he scored in the 20th over alone?',
              'answer': fin, 'margin': int(round(fin * 0.25, -1)), 'unit': 'runs',
              'hint': f'About {round(100 * fin / bat[fin_pid])}% of his {bat[fin_pid]:,} IPL runs',
              'fact': f'{fin:,} runs including {last_over_sixes[fin_pid]} sixes, the most by anyone in the last over ({to})'})

    q.append({'id': 'q-ipl-total-sixes', 'topic': 'ipl-totals', 'kind': 'number',
              'prompt': f'How many sixes have been hit in IPL history ({to})?',
              'answer': t['sixes'], 'margin': int(round(t['sixes'] * 0.2, -2)), 'unit': 'sixes',
              'hint': f"About {t['sixes'] / t['matches']:.0f} a match, over {t['matches']:,} matches",
              'fact': f"{t['sixes']:,} sixes in {t['matches']:,} matches"})

    total_km = t['run_between'] * PITCH_KM
    q.append({'id': 'q-ipl-total-km', 'topic': 'ipl-totals', 'kind': 'number',
              'prompt': 'Add up every run actually run between the wickets in IPL history (not boundaries). '
                        'At 22 yards a run, how many kilometres is that?',
              'answer': round(total_km), 'margin': int(round(total_km * 0.25, -1)), 'unit': 'km',
              'hint': f"{t['run_between']:,} runs were run",
              'fact': f'About {total_km:,.0f} km: roughly the length of India from north to south ({to})'})

    share = 100 * (4 * t['fours'] + 6 * t['sixes']) / t['runs']
    q.append({'id': 'q-ipl-boundary-share', 'topic': 'ipl-totals', 'kind': 'number',
              'prompt': 'What percentage of all IPL runs have come from fours and sixes?',
              'answer': round(share, 1), 'margin': 8, 'unit': '%',
              'hint': 'More than half',
              'fact': f"{t['fours']:,} fours and {t['sixes']:,} sixes out of {t['runs']:,} runs ({to})"})

    days = t['legal'] * SECONDS_PER_BALL / 86400
    q.append({'id': 'q-ipl-watch-every-ball', 'topic': 'ipl-totals', 'kind': 'number',
              'prompt': f'If each ball took {SECONDS_PER_BALL} seconds, how many days non-stop would it take to watch '
                        'every legal delivery in IPL history?',
              'answer': round(days), 'margin': round(days * 0.25), 'unit': 'days',
              'hint': f"There have been {t['legal']:,} legal deliveries",
              'fact': f"{t['legal']:,} balls × {SECONDS_PER_BALL} s ≈ {days:.0f} days ({to})"})

    dot_pid, dot_n = top(dots)
    innings = dot_n / 120
    q.append({'id': 'q-ipl-dot-ball-innings', 'topic': 'bhuvi', 'kind': 'number',
              'prompt': f'{name(dot_pid)} has bowled the most dot balls in the IPL: {dot_n:,}. '
                        'How many complete 20-over innings could those dots fill?',
              'answer': round(innings, 1), 'margin': 3, 'unit': 'innings',
              'hint': 'An innings is 120 balls',
              'fact': f'{dot_n:,} dots = {dot_n // 6} overs without a run off the bat ({to})'})

    wkt_pid, wkt_n = top(wkts)
    q.append({'id': 'q-ipl-most-wickets', 'topic': 'chahal', 'prompt': 'Who has taken the most wickets in IPL history?',
              'answer': name(wkt_pid), 'accept': [name(wkt_pid).split()[-1]],
              'hint': 'An Indian leg-spinner who played chess for India as a junior',
              'fact': f'{wkt_n} wickets ({to})'})

    q.append({'id': 'q-ipl-super-overs', 'topic': 'super-overs', 'kind': 'number',
              'prompt': f'How many IPL matches have gone to a Super Over ({to})?',
              'answer': t['super_over_matches'], 'margin': 4, 'unit': 'matches',
              'hint': f'Fewer than one a season, across {season - 2007} seasons',
              'fact': f"{t['super_over_matches']} of {t['matches']:,} matches"})

    q.append({'id': 'q-ipl-highest-score-opponent', 'topic': 'gayle',
              'prompt': 'Chris Gayle’s 175 not out in 2013 is the highest IPL score. Which team was it against?',
              'answer': 'Pune Warriors', 'accept': ['Pune Warriors India', 'PWI', 'Pune'],
              'hint': 'A franchise that only played three seasons',
              'fact': '175* off 66 balls with 17 sixes, for Royal Challengers Bangalore'})

    for x in q:
        x.update(format='IPL', source=CRICSHEET)
    # Fail loudly if the data moves under a hand-written hint.
    assert name(runs_pid) == 'Virat Kohli' and name(fin_pid) == 'MS Dhoni' and name(six_pid) == 'Chris Gayle', \
        'IPL leaders changed: update the hints in gen_quiz.py'
    assert name(wkt_pid) == 'Yuzvendra Chahal', 'IPL wicket leader changed: update the hint in gen_quiz.py'
    assert (t['best'][0], name(t['best'][1]), t['best'][2]) == (175, 'Chris Gayle', 'Pune Warriors'), \
        f"highest IPL score changed: {t['best']}"
    return q


def topics(q):
    """A question's topics: one name, or a list when it mentions more than one subject."""
    return q['topic'] if isinstance(q['topic'], list) else [q['topic']]


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
            return [q for d in days for q in (d[0], d[2], d[1], d[3], d[4])]
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
