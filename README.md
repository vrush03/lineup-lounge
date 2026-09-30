# Lineup Lounge

Daily cricket games. The home screen lists the modes; each has a daily round (its own stats and
streak) and a practice mode.

- **Lineup**: put five players, teams or records in order. Five attempts; each attempt marks every
  row as in the right spot (green), one place off (amber) or further away. Practice is unlimited
  and filtered by format (IPL, Test, ODI, T20I, World Cup, T20 World Cup).
- **Quiz**: five questions a day, each worth up to 100 points, so a day is out of 500. Some want a
  player or team name (typed, with autocomplete): 100 on the first try, or 50 on a second try after
  a hint. Others want a ballpark number ("how many km has Kohli run between the wickets?"): one
  guess, scored by how close it is (100 if exact, 75 at the question's margin, 0 from three margins
  off), with a number line showing where it landed.

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # scoring logic + validation of every puzzle in the dataset
npm run build
```

## Data

`src/data/cricket.json` and `src/data/quiz.json` are generated; don't edit them by hand. Sources:

| Source | Used for | Licence |
|---|---|---|
| [Cricsheet](https://cricsheet.org/) ball-by-ball data + register | IPL puzzles (complete, 2008 onward), player names and countries | [ODC-By 1.0](https://opendatacommons.org/licenses/by/1-0/) |
| Wikipedia record lists | International career/match records, World Cup timelines | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Wikidata | Full names for the few players Cricsheet only lists by initials | CC0 |
| Wikipedia (non-free files) | IPL franchise logos in `public/logos/ipl/` | Trademarks of their owners; used only to identify the teams |

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
python3 scripts/data/gen_quiz.py          # IPL questions from Cricsheet + scripts/data/quiz_manual.json -> src/data/quiz.json
npm test
```

`build.py` refuses to write a dataset with tied values, duplicate labels, a puzzle that starts
already solved, or a player name still in initials form. For the last one, add the full name to
`scripts/data/name_overrides.json` (keyed by Cricsheet identifier) after checking it.

`gen_quiz.py` computes the IPL questions (so the numbers refresh with each season) and takes the
international ones from `scripts/data/quiz_manual.json`. Every number and claim in that file, hints
and facts included, is checked against its linked Wikipedia page or ESPNcricinfo Statsguru before it
goes in; if a fact can't be sourced, the question is reworded around one that can (Sachin's Test
fours aren't recorded anywhere checkable, so the "pitch lengths" question uses his ODI career).

The script deals questions into daily sets of five: two name questions and three numbers, mixing IPL
and international, never two that share a `topic`, and never a day where one question's prompt,
hint or earlier fact contains another's answer. It fails if the data moves under a hint (a new IPL
leader, a "not out" that no longer holds), or if the questions can't fill whole days.
