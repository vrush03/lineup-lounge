"""Build the Ballpark questions: src/data/ballpark.json.

Three sources:
- Hand-written questions in ballpark_manual.json (careers, records, crowds), each checked against its page.
- Sums worked out here from sourced figures (the Laws' pitch, ball and stumps; distances and dates),
  so the arithmetic can't drift from the inputs. Each one carries its working for the reveal.
- Totals computed from Cricsheet ball-by-ball data: the IPL (complete from 2008) and the 2011 World
  Cup (all 49 matches covered). Other World Cups are left out: Cricsheet is missing some of their matches.

Questions are dealt into days of five (the app shows days in order, `day % days`; practice plays a
random day): at most two of one family, no shared topic, no question whose prompt, working or fact
states another's answer, and at most one IPL question, so the mode covers all of cricket.
"""
import datetime
import glob
import json
import math
import os
import random
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(__file__))
from common import CRICSHEET, SECONDS_PER_BALL, topics, wiki  # noqa: E402

HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, '..', '..', 'data-raw', 'cricsheet')
OUT = os.path.join(HERE, '..', '..', 'src', 'data', 'ballpark.json')
MANUAL = os.path.join(HERE, 'ballpark_manual.json')

DAY = 5
PER_FAMILY = 2  # at most this many of one family in a day
FAMILIES = ['scale', 'career', 'records', 'time', 'crowds']

# Figures from the Laws of Cricket, via Wikipedia (Cricket pitch, Wicket, Cricket ball, Cricket bat).
PITCH_M = 20.12          # 22 yards
PITCH_WIDTH_M = 3.05     # 10 ft
STUMPS_M = 0.7112        # 28 in
BALL_CIRCUMFERENCE_M = (0.224 + 0.229) / 2
BALL_MIN_G = 156
BAT_MAX_M = 0.965        # 38 in
# Randomly poured spheres fill about 64% of a space.
PACKING = 0.64
BALL_VOLUME_M3 = 4 / 3 * math.pi * (BALL_CIRCUMFERENCE_M / (2 * math.pi)) ** 3


def sig(x, digits=3):
    """Round to `digits` significant figures, for answers that rest on an assumption (how balls pack)."""
    r = round(x, digits - 1 - int(math.floor(math.log10(abs(x)))))
    return int(r) if r == int(r) else r


def fmt(x):
    return f'{x:,.0f}' if abs(x) >= 100 else f'{x:,.2f}'.rstrip('0').rstrip('.')


def days_between(a, b):
    return (datetime.date.fromisoformat(b) - datetime.date.fromisoformat(a)).days


def worked_questions():
    """Sums from sourced figures. Assumptions are stated in the prompt or the working."""
    field = math.pi * 70 ** 2
    box = PITCH_M * PITCH_WIDTH_M * STUMPS_M
    ball_d = BALL_CIRCUMFERENCE_M / math.pi
    pitch, wicket, ball, bat = wiki('Cricket_pitch'), wiki('Wicket'), wiki('Cricket_ball'), wiki('Cricket_bat')
    q = [
        {'id': 'b-shoes-field', 'family': 'scale', 'topic': 'field-70',
         'prompt': 'How many pairs of shoes, laid flat side by side, would cover a round cricket field whose boundary is 70 m from the centre? Take a pair as 30 cm by 22 cm.',
         'answer': sig(field / (0.30 * 0.22)), 'unit': 'pairs',
         'working': f'The field is a circle of radius 70 m: π × 70² ≈ {fmt(field)} m². A pair covers 0.066 m², so {fmt(field)} ÷ 0.066.',
         'sources': []},
        {'id': 'b-pitches-in-field', 'family': 'scale', 'topic': ['field-70', 'pitch'],
         'prompt': 'How many 22-yard pitches would fit, side by side, inside a round field whose boundary is 70 m from the centre?',
         'answer': round(field / (PITCH_M * PITCH_WIDTH_M)), 'unit': 'pitches',
         'working': f'π × 70² ≈ {fmt(field)} m² of field. A pitch is 20.12 m by 3.05 m, about {fmt(PITCH_M * PITCH_WIDTH_M)} m².',
         'sources': [pitch]},
        {'id': 'b-marathon-laps', 'family': 'scale', 'topic': 'field-70',
         'prompt': 'How many laps of the boundary rope would you need to run a marathon, on a round field whose boundary is 70 m from the centre?',
         'answer': round(42195 / (2 * math.pi * 70)), 'unit': 'laps',
         'working': f'The rope is 2 × π × 70 ≈ {fmt(2 * math.pi * 70)} m round; a marathon is 42,195 m.',
         'sources': [wiki('Marathon')]},
        {'id': 'b-balls-fill-pitch', 'family': 'scale', 'topic': ['pitch', 'ball'],
         'prompt': 'How many cricket balls would fill a box the size of the pitch, as tall as the stumps?',
         'answer': sig(box * PACKING / BALL_VOLUME_M3), 'unit': 'balls',
         'working': f'The box is 20.12 m × 3.05 m × 0.71 m ≈ {fmt(box)} m³. A ball 7.2 cm across takes up {BALL_VOLUME_M3 * 1e6:,.0f} cm³, and poured balls fill about 64% of a space.',
         'sources': [pitch, wicket, ball]},
        {'id': 'b-balls-fill-pool', 'family': 'scale', 'topic': 'ball',
         'prompt': 'How many cricket balls would fill an Olympic swimming pool?',
         'answer': sig(2500 * PACKING / BALL_VOLUME_M3), 'unit': 'balls',
         'working': f'The pool holds 2,500 m³. A ball 7.2 cm across takes up {BALL_VOLUME_M3 * 1e6:,.0f} cm³, and poured balls fill about 64% of a space.',
         'sources': [wiki('Olympic-size_swimming_pool'), ball]},
        {'id': 'b-balls-tonne', 'family': 'scale', 'topic': 'ball',
         'prompt': 'How many cricket balls, at the 156 g the Laws allow at the lightest, make up one tonne?',
         'answer': round(1e6 / BALL_MIN_G), 'unit': 'balls',
         'working': '1,000,000 g ÷ 156 g.',
         'sources': [ball]},
        {'id': 'b-balls-along-pitch', 'family': 'scale', 'topic': ['pitch', 'ball'],
         'prompt': 'How many cricket balls, touching in a row, would stretch from one set of stumps to the other?',
         'answer': round(PITCH_M / ball_d), 'unit': 'balls',
         'working': f'The pitch is 20.12 m and a ball is about {ball_d * 100:.1f} cm across (22.4 to 22.9 cm round).',
         'sources': [pitch, ball]},
        {'id': 'b-pitches-equator', 'family': 'scale', 'topic': 'pitch',
         'prompt': 'How many 22-yard pitches, laid end to end, would go once round the Equator?',
         'answer': sig(40_075_000 / PITCH_M), 'unit': 'pitches',
         'working': 'The Equator is 40,075 km, or 40,075,000 m; a pitch is 20.12 m.',
         'sources': [wiki('Equator'), pitch]},
        {'id': 'b-stumps-everest', 'family': 'scale', 'topic': 'stumps',
         'prompt': 'How many stumps, stacked end on end, would reach the top of Mount Everest?',
         'answer': round(8848.86 / STUMPS_M), 'unit': 'stumps',
         'working': 'Everest is 8,848.86 m high; a stump stands 71.12 cm (28 in).',
         'sources': [wiki('Mount_Everest'), wicket]},
        {'id': 'b-bats-km', 'family': 'scale', 'topic': 'bat',
         'prompt': 'How many full-length cricket bats, laid end to end, would stretch one kilometre?',
         'answer': round(1000 / BAT_MAX_M), 'unit': 'bats',
         'working': 'The Laws allow a bat up to 96.5 cm (38 in) long: 1,000 m ÷ 0.965 m.',
         'sources': [bat]},
        {'id': 'b-nms-seats-line', 'family': 'scale', 'topic': 'nms',
         'prompt': 'If every seat in the 132,000-capacity Narendra Modi Stadium were set in one straight line, 50 cm apart, how many km long would it be?',
         'answer': round(132000 * 0.5 / 1000), 'unit': 'km',
         'working': '132,000 × 0.5 m = 66,000 m.',
         'sources': [wiki('Narendra_Modi_Stadium')]},
        {'id': 'b-shoaib-ms', 'family': 'time', 'topic': 'shoaib',
         'prompt': 'At 161.3 km/h, the fastest delivery ever recorded, how many milliseconds would a ball take to travel the 22 yards of the pitch?',
         'answer': round(PITCH_M / (161.3 / 3.6) * 1000), 'unit': 'ms',
         'working': f'161.3 km/h is {161.3 / 3.6:.1f} m a second, and the pitch is 20.12 m. Bowled by Shoaib Akhtar.',
         'sources': [wiki('Shoaib_Akhtar'), pitch]},
        {'id': 'b-sachin-test-days', 'family': 'time', 'topic': 'sachin', 'format': 'Test',
         'prompt': "How many days passed between Sachin Tendulkar's first Test and his last?",
         'answer': days_between('1989-11-15', '2013-11-14'), 'unit': 'days',
         'working': 'From 15 November 1989, against Pakistan, to 14 November 2013, against West Indies.',
         'sources': [wiki('Sachin_Tendulkar')]},
        {'id': 'b-warne-test-days', 'family': 'time', 'topic': 'warne', 'format': 'Test',
         'prompt': "How many days passed between Shane Warne's first Test and his last?",
         'answer': days_between('1992-01-02', '2007-01-02'), 'unit': 'days',
         'working': 'From 2 January 1992 to 2 January 2007: fifteen years to the day.',
         'sources': [wiki('Shane_Warne')]},
        {'id': 'b-kallis-test-days', 'family': 'time', 'topic': 'kallis', 'format': 'Test',
         'prompt': "How many days passed between Jacques Kallis's first Test and his last?",
         'answer': days_between('1995-12-14', '2013-12-26'), 'unit': 'days',
         'working': 'From 14 December 1995, against England, to 26 December 2013, against India.',
         'sources': [wiki('Jacques_Kallis')]},
        {'id': 'b-test-to-odi-days', 'family': 'time', 'topic': 'firsts',
         'prompt': 'How many days passed between the first Test match and the first ODI?',
         'answer': days_between('1877-03-15', '1971-01-05'), 'unit': 'days',
         'working': 'The first Test began at the MCG on 15 March 1877; the first ODI was played there on 5 January 1971.',
         'sources': [wiki('Test_cricket'), wiki('One_Day_International')]},
        {'id': 'b-odi-to-t20i-days', 'family': 'time', 'topic': 'firsts',
         'prompt': "How many days passed between the first ODI and the first men's T20I?",
         'answer': days_between('1971-01-05', '2005-02-17'), 'unit': 'days',
         'working': 'From 5 January 1971 (Australia v England) to 17 February 2005 (New Zealand v Australia).',
         'sources': [wiki('One_Day_International'), wiki('Twenty20_International')]},
    ]
    return q


def matches(folder, keep=lambda info: True):
    for path in sorted(glob.glob(os.path.join(ROOT, folder, '*.json'))):
        d = json.load(open(path))
        if keep(d['info']):
            yield d


class Totals:
    """Counts over a set of matches, super overs left out."""

    def __init__(self, games):
        self.matches = self.deliveries = self.runs = self.fours = self.sixes = self.noballs = 0
        self.caught = self.run_outs = self.stumped = self.ducks = self.fifties = self.maidens = 0
        self.seasons = set()
        for d in games:
            self.matches += 1
            self.seasons.add(int(d['info']['dates'][0][:4]))
            for inn in d['innings']:
                if inn.get('super_over'):
                    continue
                runs = Counter()
                out = set()
                for over in inn['overs']:
                    conceded = legal = 0
                    for b in over['deliveries']:
                        extras = b.get('extras', {})
                        r = b['runs']['batter']
                        boundary = r in (4, 6) and not b['runs'].get('non_boundary')
                        self.deliveries += 1
                        self.runs += b['runs']['total']
                        runs[b['batter']] += r
                        self.fours += boundary and r == 4
                        self.sixes += boundary and r == 6
                        self.noballs += 'noballs' in extras
                        conceded += r + extras.get('wides', 0) + extras.get('noballs', 0)
                        legal += 'wides' not in extras and 'noballs' not in extras
                        for w in b.get('wickets', []):
                            kind = w['kind']
                            self.caught += kind in ('caught', 'caught and bowled')
                            self.run_outs += kind == 'run out'
                            self.stumped += kind == 'stumped'
                            if kind not in ('retired hurt', 'retired not out'):
                                out.add(w['player_out'])
                    self.maidens += legal >= 6 and conceded == 0
                self.ducks += sum(1 for p in out if runs[p] == 0)
                self.fifties += sum(1 for n in runs.values() if 50 <= n < 100)


def cricsheet_questions():
    ipl = Totals(matches('ipl'))
    last = max(ipl.seasons)
    assert min(ipl.seasons) == 2008 and len(ipl.seasons) == last - 2007, 'an IPL season is missing'
    to = f'(to the end of IPL {last})'
    finals = Totals(matches('ipl', lambda i: i.get('event', {}).get('stage') == 'Final'))
    assert finals.matches == len(ipl.seasons), 'expected one final per season'
    wc = Totals(matches('odis', lambda i: i.get('event', {}).get('name') == 'ICC Cricket World Cup'
                        and i['dates'][0].startswith('2011') and i.get('gender') == 'male'))
    assert wc.matches == 49, f'2011 World Cup: expected all 49 matches, found {wc.matches}'

    ipl_q = [
        ('b-ipl-runs', f'How many runs have been scored in the IPL, all told {to}?', ipl.runs, 'runs'),
        ('b-ipl-fours', f'How many fours have been hit in the IPL {to}?', ipl.fours, 'fours'),
        ('b-ipl-catches', f'How many IPL wickets have fallen to catches {to}?', ipl.caught, 'catches'),
        ('b-ipl-ducks', f'How many times has a batter been out for a duck in the IPL {to}?', ipl.ducks, 'ducks'),
        ('b-ipl-maidens', f'How many maiden overs have been bowled in the IPL {to}?', ipl.maidens, 'maidens'),
        ('b-ipl-noballs', f'How many no-balls have been bowled in the IPL {to}?', ipl.noballs, 'no-balls'),
        ('b-ipl-run-outs', f'How many run-outs have there been in the IPL {to}?', ipl.run_outs, 'run-outs'),
        ('b-ipl-fifties', f'How many times has a batter scored 50 to 99 in an IPL innings {to}?', ipl.fifties, 'innings'),
        ('b-ipl-stumpings', f'How many IPL batters have been stumped {to}?', ipl.stumped, 'stumpings'),
    ]
    q = [{'id': i, 'family': 'records', 'topic': i, 'format': 'IPL', 'prompt': p, 'answer': n, 'unit': u,
          'fact': f'Across {ipl.matches:,} matches, super overs left out.', 'sources': [CRICSHEET]}
         for i, p, n, u in ipl_q]
    q.append({'id': 'b-ipl-finals-hours', 'family': 'time', 'topic': 'ipl-finals', 'format': 'IPL',
              'prompt': f'If every delivery took {SECONDS_PER_BALL} seconds, how many hours would it take to watch every ball of every IPL final {to}?',
              'answer': round(finals.deliveries * SECONDS_PER_BALL / 3600), 'unit': 'hours',
              'working': f'{finals.deliveries:,} deliveries in {finals.matches} finals, wides and no-balls included, × {SECONDS_PER_BALL} seconds.',
              'sources': [CRICSHEET]})
    q.append({'id': 'b-wc2011-sixes', 'family': 'records', 'topic': 'wc2011', 'format': 'World Cup',
              'prompt': 'How many sixes were hit at the 2011 World Cup in India, Sri Lanka and Bangladesh?',
              'answer': wc.sixes, 'unit': 'sixes',
              'fact': f'Across all {wc.matches} matches, with {wc.fours:,} fours.', 'sources': [CRICSHEET]})
    q.append({'id': 'b-wc2011-hours', 'family': 'time', 'topic': 'wc2011', 'format': 'World Cup',
              'prompt': f'If every delivery took {SECONDS_PER_BALL} seconds, how many hours would it take to watch every ball of the 2011 World Cup?',
              'answer': round(wc.deliveries * SECONDS_PER_BALL / 3600), 'unit': 'hours',
              'working': f'{wc.deliveries:,} deliveries in {wc.matches} matches, wides and no-balls included, × {SECONDS_PER_BALL} seconds.',
              'sources': [CRICSHEET]})
    return q


def numbers(q):
    """The answer as it might be written in another question: '132,000' and '132000'. Small answers are left
    out, since numbers under 100 turn up everywhere."""
    a = q['answer']
    return [] if a < 100 or a != int(a) else [f'{int(a):,}', str(int(a))]


def gives_away(q, other):
    """Whether `other`'s prompt, working or fact states `q`'s answer."""
    text = ' '.join(other.get(k, '') for k in ('prompt', 'working', 'fact'))
    return any(re.search(rf'(?<![\d,.]){re.escape(n)}(?![\d,])', text) for n in numbers(q))


def deal(questions, seed='ballpark'):
    """Order questions into days of five; see the module docstring for the rules."""
    assert len(questions) % DAY == 0, f'{len(questions)} questions: need a multiple of {DAY} (whole days)'
    n_days = len(questions) // DAY
    count = Counter(q['family'] for q in questions)
    assert max(count.values()) <= n_days * PER_FAMILY, f'too many questions in one family for {n_days} days: {dict(count)}'

    def fits(day, q):
        return (len(day) < DAY and sum(x['family'] == q['family'] for x in day) < PER_FAMILY
                and not {t for x in day for t in topics(x)} & set(topics(q))
                and not (q.get('format') == 'IPL' and any(x.get('format') == 'IPL' for x in day))
                and not any(gives_away(q, x) or gives_away(x, q) for x in day))

    rng = random.Random(seed)
    for _ in range(5000):
        pool = questions[:]
        rng.shuffle(pool)
        # Place the biggest families first, each into the emptiest day that takes it.
        pool.sort(key=lambda q: -count[q['family']])
        days = [[] for _ in range(n_days)]
        for q in pool:
            open_days = [d for d in days if fits(d, q)]
            if not open_days:
                break
            least = min(len(d) for d in open_days)
            rng.choice([d for d in open_days if len(d) == least]).append(q)
        else:
            rng.shuffle(days)
            for d in days:
                rng.shuffle(d)
            return [q for d in days for q in d]
    raise SystemExit('could not deal the questions into valid days: add questions or loosen topics')


def main():
    manual = json.load(open(MANUAL))['questions']
    for q in manual:
        q['sources'] = [wiki(s[len('wiki:'):]) for s in q['sources']]
    questions = manual + worked_questions() + cricsheet_questions()
    ids = [q['id'] for q in questions]
    assert len(set(ids)) == len(ids), 'duplicate ids'
    for q in questions:
        assert q['family'] in FAMILIES, q['id']
        assert q['answer'] > 0, q['id']
        assert q['sources'] or q.get('working'), f"{q['id']}: needs a source or a working"
    questions = deal(questions)
    for q in questions:
        del q['topic']
    json.dump(questions, open(OUT, 'w'), indent=1, ensure_ascii=False)
    print(f'{len(questions)} questions ({len(questions) // DAY} days) -> {os.path.relpath(OUT)}')
    print(dict(Counter(q['family'] for q in questions)), 'IPL:', sum(q.get('format') == 'IPL' for q in questions))


if __name__ == '__main__':
    main()
