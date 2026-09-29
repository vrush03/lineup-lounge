"""Assemble the final puzzle set: src/data/cricket.json.

Takes ranked lists (IPL, from Cricsheet) and ready-made top-5 puzzles (Wikipedia), resolves
player names, picks five well-separated items per list, shuffles them so no puzzle starts
solved, grades difficulty, and interleaves formats so consecutive days feel different.
"""
import hashlib
import json
import os
import random
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from names import Names, needs_review  # noqa: E402

HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, '..', '..', 'data-raw')
OUT = os.path.join(HERE, '..', '..', 'src', 'data', 'cricket.json')
POOL = 12        # pick from the top-N of a ranked list
TIMELINE_VARIANTS = 3


def rng_for(key):
    return random.Random(int(hashlib.sha1(key.encode()).hexdigest()[:12], 16))


def min_gap(values, kind='ranked'):
    """Smallest step between neighbouring values, relative to the larger (years/10 for timelines)."""
    vals = sorted(values)
    if kind == 'timeline':
        return min((b - a) / 10 for a, b in zip(vals, vals[1:]))
    return min((b - a) / max(abs(b), abs(a), 1e-9) for a, b in zip(vals, vals[1:]))


def tier(gap):
    return 'easy' if gap >= 0.12 else 'medium' if gap >= 0.04 else 'hard'


def pick_ranked(items, rng):
    """Five items from the head of a ranked list with distinct values.

    Each puzzle is assigned a target difficulty (mostly easy/medium) and we sample until the
    spacing between neighbouring values matches it; #1 is included more often than not.
    """
    pool, seen = [], set()
    for i in items:
        if i['value'] in seen:
            continue
        seen.add(i['value'])
        pool.append(i)
        if len(pool) == POOL:
            break
    if len(pool) < 5:
        return None
    target = rng.choices(['easy', 'medium', 'hard'], weights=[35, 45, 20])[0]
    best = None
    for _ in range(400):
        chosen = pool[:1] + rng.sample(pool[1:], 4) if rng.random() < 0.6 else rng.sample(pool, 5)
        gap = min_gap([i['value'] for i in chosen])
        if tier(gap) == target:
            best = chosen
            break
        if best is None or abs(gap - 0.08) < abs(min_gap([i['value'] for i in best]) - 0.08):
            best = chosen
    return sorted(best, key=pool.index)


def pick_timeline(items, rng):
    """Five items from distinct groups, each at its FIRST occurrence (India's first title, not a random one).

    Prompts say "in order of their first ..." so there's exactly one right answer.
    """
    first = {}
    for i in items:
        g = i.get('group') or i.get('pid') or i['label']
        if g not in first or i['value'] < first[g]['value']:
            first[g] = i
    if len(first) < 5:
        return None
    return sorted(rng.sample(sorted(first.values(), key=lambda i: i['value']), 5), key=lambda i: i['value'])


def shuffled(items, rng):
    """Shuffle so at most one item starts in its correct slot."""
    for _ in range(200):
        out = items[:]
        rng.shuffle(out)
        if sum(a is b for a, b in zip(out, items)) <= 1:
            return out
    return items[::-1]


def difficulty(items, kind):
    return tier(min_gap([i['value'] for i in items], 'timeline' if kind == 'timeline' else 'ranked'))


def main():
    names = Names()
    # Lists (build picks five items each): IPL from Cricsheet, tournament timelines from Wikipedia.
    ipl = json.load(open(os.path.join(ROOT, 'build', 'ipl_lists.json')))
    ipl += json.load(open(os.path.join(ROOT, 'build', 'wiki_lists.json')))
    wiki = json.load(open(os.path.join(ROOT, 'build', 'wiki_puzzles.json')))

    candidates = {i['pid'] for lst in ipl
                  for i in (lst['items'] if lst['kind'] == 'timeline' else lst['items'][:POOL + 4]) if i.get('pid')}
    names.resolve_initials(candidates)

    puzzles = []
    for lst in ipl:
        items = []
        for i in lst['items']:
            i = dict(i)
            if i.get('pid'):
                info = names.info(i['pid'])
                i['label'] = info['name']
                i['person'] = True
                i['country'] = info.get('country')
            items.append(i)
        variants = TIMELINE_VARIANTS if lst['kind'] == 'timeline' else 1
        seen_sets = set()
        for v in range(variants):
            key = lst['id'] + (f'-{v + 1}' if variants > 1 else '')
            rng = rng_for(key)
            chosen = pick_timeline(items, rng) if lst['kind'] == 'timeline' else pick_ranked(items, rng)
            if not chosen:
                continue
            sig = frozenset(i['label'] for i in chosen)
            if sig in seen_sets or len(sig) < 5:
                continue
            seen_sets.add(sig)
            puzzles.append(finish(key, lst, chosen, rng))

    for p in wiki:
        puzzles.append(finish(p['id'], {**p, 'kind': 'record', 'tags': ['records']}, p['items'], rng_for(p['id'])))

    validate(puzzles)
    puzzles = interleave(puzzles)
    for p in puzzles:
        for i in p['items']:
            i.pop('person', None)
    json.dump(puzzles, open(OUT, 'w'), indent=1, ensure_ascii=False)
    by_fmt = defaultdict(int)
    for p in puzzles:
        by_fmt[p['format']] += 1
    print(f'{len(puzzles)} puzzles -> {os.path.relpath(OUT)}', dict(by_fmt))
    print('by difficulty', {d: sum(p['difficulty'] == d for p in puzzles) for d in ('easy', 'medium', 'hard')})


def finish(pid, lst, chosen, rng):
    def fmt_value(i):
        v = i['value']
        return i.get('display') or (f'{int(v):,}' if float(v).is_integer() else f'{v}')

    items = [{k: v for k, v in {
        'label': i['label'],
        'value': i['value'],
        'display': fmt_value(i),
        'note': i.get('note') or '',
        'team': i.get('team'),
        'country': i.get('country'),
        'person': i.get('person') or None,  # checked by validate(), stripped before writing
    }.items() if v is not None} for i in chosen]
    return {
        'id': pid,
        'prompt': lst['prompt'],
        'format': lst['format'],
        'direction': lst['direction'],
        'unit': lst.get('unit') or '',
        'difficulty': difficulty(chosen, lst['kind']),
        'tags': lst.get('tags', []),
        'items': shuffled(items, rng),
        'source': lst['source'],
        'asOf': lst.get('asOf'),
    }


def validate(puzzles):
    ids = set()
    unnamed = {part for p in puzzles for i in p['items'] if i.get('person')
               for part in i['label'].split(' & ') if needs_review(part)}
    assert not unnamed, (f'player names that are initials or a lone first name: {sorted(unnamed)}. Add the full names to '
                         f'scripts/data/name_overrides.json (or KNOWN_BY_INITIALS in names.py).')
    for p in puzzles:
        assert p['id'] not in ids, f"duplicate id {p['id']}"
        ids.add(p['id'])
        labels = [i['label'] for i in p['items']]
        values = [i['value'] for i in p['items']]
        assert len(p['items']) == 5, p['id']
        assert len(set(labels)) == 5, f"duplicate labels in {p['id']}: {labels}"
        assert len(set(values)) == 5, f"tied values in {p['id']}: {values}"
        best = sorted(p['items'], key=lambda i: i['value'], reverse=p['direction'] == 'desc')
        assert best != p['items'], f"{p['id']} starts solved"


def interleave(puzzles):
    """Round-robin across formats (in a fixed shuffled order) so daily puzzles vary."""
    rng = rng_for('interleave')
    buckets = defaultdict(list)
    for p in puzzles:
        buckets[p['format']].append(p)
    for b in buckets.values():
        rng.shuffle(b)
    # weight: take from the fullest buckets more often
    out = []
    while any(buckets.values()):
        live = [f for f, b in buckets.items() if b]
        f = rng.choices(live, weights=[len(buckets[x]) for x in live])[0]
        if out and out[-1]['format'] == f and len(live) > 1:
            f = rng.choice([x for x in live if x != f])
        out.append(buckets[f].pop())
    return spread_repeats(out)


def spread_repeats(order, gap=30):
    """Keep puzzles sharing a prompt (timeline variants) at least `gap` days apart, wrap-around included."""
    n = len(order)
    groups = defaultdict(list)
    for p in order:
        groups[p['prompt']].append(p)
    repeated = [g for g in groups.values() if len(g) > 1]
    # Spread each group evenly around the cycle, staggering groups so they don't pile up on the same days.
    slots = {}
    for gi, g in enumerate(repeated):
        for m, p in enumerate(g):
            s = round((gi / len(repeated) / len(g) + m / len(g)) * n) % n
            while s in slots:
                s = (s + 1) % n
            slots[s] = p
    rest = iter(p for p in order if len(groups[p['prompt']]) == 1)
    order = [slots[k] if k in slots else next(rest) for k in range(n)]
    worst = min((min(i - j, n - (i - j)) for i in range(n) for j in range(i) if order[i]['prompt'] == order[j]['prompt']),
                default=n)
    assert worst >= gap, f'puzzles with the same prompt only {worst} days apart in the daily rotation'
    return order


if __name__ == '__main__':
    main()
