"""Display names and countries for Cricsheet people.

Cricsheet match files use scorecard names ("SR Tendulkar"). Its register's names.csv lists
the variants each person appears under across sources, which usually includes the full
name ("Sachin Tendulkar"). When every variant is initials ("K Pollard"), we fall back to
Wikidata, which links people to the same ESPNcricinfo id (property P2697).

Country comes from the team a player has represented most often in men's internationals
in the Cricsheet data.
"""
import csv
import json
import os
import re
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'data-raw')
CACHE = os.path.join(ROOT, 'cache', 'wikidata_names.json')
OVERRIDES = os.path.join(os.path.dirname(__file__), 'name_overrides.json')
# Players universally known by their initials; fine to show as-is.
KNOWN_BY_INITIALS = {'MS Dhoni', 'KL Rahul', 'AB de Villiers', 'RP Singh', 'VVS Laxman', 'JP Duminy', 'KC Cariappa',
                     'CK Nayudu', 'JJ Ferris', 'WG Grace', 'CB Fry', 'AB Agarkar', 'MS Gony', 'S Sreesanth',
                     # single names that are complete
                     'Misbah-ul-Haq', 'Inzamam-ul-Haq', 'Imam-ul-Haq', 'Ihsanullah', 'Naveen-ul-Haq'}
INTL = {'Test', 'ODI', 'T20I'}
UA = {'User-Agent': 'LineupLounge/0.1 (cricket puzzle dataset build)'}


def tidy(name):
    """'R. P. Singh' -> 'RP Singh', so initials are written one consistent way."""
    return re.sub(r'\b((?:[A-Z]\.\s*)+)(?=[A-Z][a-z])', lambda m: m.group(1).replace('.', '').replace(' ', '') + ' ', name).strip()


def has_initials(name):
    return any(re.fullmatch(r'[A-Z]{1,4}|([A-Z]\.)+', t) for t in name.split())


def incomplete(name):
    """Initials ("K Pollard") or a lone first name ("Robin"): not how anyone would recognise them."""
    return has_initials(name) or len(name.split()) < 2


def needs_review(name):
    return incomplete(name) and name not in KNOWN_BY_INITIALS


def _score(name):
    """Prefer complete names; among those, the shortest. Initials beat a lone first name."""
    return (incomplete(name), len(name.split()) < 2, len(name))


def _wikidata(params):
    url = 'https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode({**params, 'format': 'json'})
    for attempt in range(5):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))
        except Exception:
            time.sleep(5 * (attempt + 1))
    return None


class Names:
    def __init__(self):
        self.people = {r['identifier']: r for r in csv.DictReader(open(os.path.join(ROOT, 'cricsheet', 'people.csv')))}
        self.variants = defaultdict(set)
        for r in csv.DictReader(open(os.path.join(ROOT, 'cricsheet', 'names.csv'))):
            self.variants[r['identifier']].add(r['name'].strip())
        self.wikidata = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
        self.overrides = {k: v for k, v in json.load(open(OVERRIDES)).items() if not k.startswith('_')}
        self._country = None

    def _countries(self):
        if self._country is None:
            matches = {m['id']: m['fmt'] for m in json.load(open(os.path.join(ROOT, 'build', 'matches.json')))}
            teams = defaultdict(Counter)
            for r in json.load(open(os.path.join(ROOT, 'build', 'player_matches.json'))):
                if matches.get(r['mid']) in INTL:
                    teams[r['pid']][r['team']] += 1
            self._country = {pid: c.most_common(1)[0][0] for pid, c in teams.items()}
        return self._country

    def _register_name(self, pid):
        options = self.variants[pid] | {self.people.get(pid, {}).get('name', '')}
        return min((n for n in options if n), key=_score, default=pid)

    def info(self, pid):
        if pid in self.overrides:
            return {'name': self.overrides[pid], 'country': self._countries().get(pid), 'initials': False}
        name = self._register_name(pid)
        if incomplete(name):
            full = self.wikidata.get(self.people.get(pid, {}).get('key_cricinfo'))
            if full:
                name = re.sub(r'\s*\(.*\)$', '', full)  # drop "(cricketer)" style suffixes
        name = tidy(name)
        return {'name': name, 'country': self._countries().get(pid), 'initials': needs_review(name)}

    def resolve_initials(self, pids):
        """Look up Wikidata labels for people whose register names are all initials (cached)."""
        todo = []
        for pid in pids:
            key = self.people.get(pid, {}).get('key_cricinfo')
            if key and key not in self.wikidata and incomplete(self._register_name(pid)):
                todo.append(key)
        qids = {}
        for n, key in enumerate(todo, 1):  # one id per search: batch calls get rate-limited
            r = _wikidata({'action': 'query', 'list': 'search', 'srsearch': f'haswbstatement:P2697={key}', 'srlimit': 2})
            hits = r and r['query']['search']
            qids[key] = hits[0]['title'] if hits and len(hits) == 1 else None
            print(f'  wikidata {n}/{len(todo)}', end='\r', flush=True)
            time.sleep(1)
        found = [q for q in qids.values() if q]
        labels = {}
        for i in range(0, len(found), 50):
            r = _wikidata({'action': 'wbgetentities', 'ids': '|'.join(found[i:i + 50]), 'props': 'labels',
                           'languages': 'en'})
            labels.update({q: e.get('labels', {}).get('en', {}).get('value') for q, e in (r or {}).get('entities', {}).items()})
        for key, q in qids.items():
            self.wikidata[key] = labels.get(q) if q else None
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        json.dump(self.wikidata, open(CACHE, 'w'), indent=0, ensure_ascii=False)
