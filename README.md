# Lineup Lounge

A daily cricket ranking puzzle: put five players, teams or records in order. Five attempts; each
attempt marks every row as in the right spot (green), one place off (amber) or further away.
There's one daily puzzle (counts towards your streak) and an unlimited practice mode filtered by
format (IPL, Test, ODI, T20I, World Cup, T20 World Cup).

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # scoring logic + validation of every puzzle in the dataset
npm run build
```

## Data

`src/data/cricket.json` is generated; don't edit it by hand. Sources:

| Source | Used for | Licence |
|---|---|---|
| [Cricsheet](https://cricsheet.org/) ball-by-ball data + register | IPL puzzles (complete, 2008 onward), player names and countries | [ODC-By 1.0](https://opendatacommons.org/licenses/by/1-0/) |
| Wikipedia record lists | International career/match records, World Cup timelines | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Wikidata | Full names for the few players Cricsheet only lists by initials | CC0 |

Cricsheet is missing some international matches (withheld or not yet covered), so international
puzzles come from Wikipedia's maintained record tables, not from Cricsheet aggregates.

### Refreshing

Raw downloads live in `data-raw/` (git-ignored, about 80 MB).

```bash
# 1. Cricsheet (men's matches + register)
cd data-raw/cricsheet
for f in tests odis t20s ipl; do curl -sfLO https://cricsheet.org/downloads/${f}_json.zip && unzip -qo ${f}_json.zip -d $f; done
curl -sfLO https://cricsheet.org/register/people.csv && curl -sfLO https://cricsheet.org/register/names.csv
cd ../..

# 2. Wikipedia pages: re-fetch data-raw/wiki/*.json with the parse API
#    (action=parse&prop=text|revid) and revision_dates.json with prop=revisions.

# 3. Build
python3 scripts/data/parse_cricsheet.py   # per-match / per-player-match records
python3 scripts/data/gen_ipl.py           # ranked IPL lists
python3 scripts/data/gen_wiki.py          # Wikipedia record puzzles + tournament lists
python3 scripts/data/build.py             # pick 5 items per list, shuffle, validate -> src/data/cricket.json
npm test
```

`build.py` refuses to write a dataset with tied values, duplicate labels, a puzzle that starts
already solved, or a player name still in initials form. For the last one, add the full name to
`scripts/data/name_overrides.json` (keyed by Cricsheet identifier) after checking it.
