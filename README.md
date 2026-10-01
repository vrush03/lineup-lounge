# Lineup Lounge

Cricket games. The home screen lists the modes; Lineup and Quiz each have a daily round (with its
own stats and streak) and a practice mode, and Showdown is free play.

- **Lineup**: put five players, teams or records in order. Five attempts; each attempt marks every
  row as in the right spot (green), one place off (amber) or further away. Practice is unlimited
  and filtered by format (IPL, Test, ODI, T20I, World Cup, T20 World Cup).
- **Quiz**: five questions a day, each worth up to 100 points, so a day is out of 500. Some want a
  player or team name (typed, with autocomplete): 100 on the first try, or 50 on a second try after
  a hint. Others want a ballpark number ("how many km has Kohli run between the wickets?"): one
  guess, scored by how close it is (100 if exact, 75 at the question's margin, 0 from three margins
  off), with a number line showing where it landed.
- **Showdown**: stat cards against the computer. Pick a format (ODI, T20I, Test or IPL); 30 cards
  from that format's deck (64 to 100 players) are dealt 15 each. You and the computer take turns
  naming a stat, the higher number takes both cards, and a tie leaves them in a pot for the next
  winner. Whoever ends up with all 30 wins. A game in progress is saved per format.

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # scoring logic + validation of every puzzle in the dataset
npm run build
```

## Data

`src/data/cricket.json`, `src/data/quiz.json` and `src/data/cards.json` are generated; don't edit
them by hand. Sources:

| Source | Used for | Licence |
|---|---|---|
| [Cricsheet](https://cricsheet.org/) ball-by-ball data + register | IPL puzzles (complete, 2008 onward), player names and countries | [ODC-By 1.0](https://opendatacommons.org/licenses/by/1-0/) |
| Wikipedia record lists | International career/match records, World Cup timelines | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Wikidata | Full names for the few players Cricsheet only lists by initials | CC0 |
| Wikipedia (non-free files) | IPL franchise logos in `public/logos/ipl/` | Trademarks of their owners; used only to identify the teams |
| Wikipedia player infoboxes | Test, ODI and T20I career stats on the Showdown cards | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Player photos in `public/players/` | Showdown cards | Each file's source and credit is in `scripts/data/player_photos.json` |

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
python3 scripts/data/gen_cards.py         # Showdown decks -> src/data/cards.json (add --refresh to re-fetch Wikipedia)
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

`gen_cards.py` builds one Showdown deck per format from the players listed in
`scripts/data/cards_players.json`. Test, ODI and T20I figures are read from the career table in each
player's Wikipedia infobox (cached in `data-raw/wiki/players/`), because Cricsheet's international
coverage starts in the 2000s; the IPL deck is computed from Cricsheet. Infoboxes of current players
lag a few matches behind, so each deck carries an "as of" date. Every stat is higher-wins. The script
fails if a player has no column for the format or two cards have identical stats. A card gets a
photo when `public/players/<name-in-lower-case-with-hyphens>.jpg` exists (the script lists the players
without one; they show initials on the team colour), so re-run it after adding photos.
