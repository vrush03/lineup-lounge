# Lineup Lounge

Cricket games. The home screen lists the modes; Lineup, Ballpark and Who Am I? each have a daily
round (with its own stats and streak) and a practice mode, and Showdown is free play.

- **Lineup**: put five players, teams or records in order. Five attempts; each attempt marks every
  row as in the right spot (green), one place off (amber) or further away. Practice is unlimited
  and filtered by format (IPL, Test, ODI, T20I, World Cup, T20 World Cup).
- **Ballpark**: five estimation questions a day, out of 500, across all of cricket: careers,
  record books, crowds, dates and size-it-up sums ("how many cricket balls would fill an Olympic
  pool?"). One guess each, scored by how many times off it is: 100 within 5%, 70 at 2× off, 52 at
  3×, 0 at 10×, the same whether too high or too low. The reveal shows a log number line.
- **Showdown**: stat cards against the computer. Pick a format (ODI, T20I, Test or IPL); 30 cards
  from that format's deck (64 to 100 players) are dealt 15 each. Each round both sides play a card;
  you and the computer take turns naming a stat, and the higher number scores 10 points (5 each on
  a tie). Most points after 15 rounds wins. A game in progress is saved per format.
- **Who Am I?**: a stat card with the name, team and photo hidden; name the player in five guesses,
  picked from that format's deck. Each wrong guess shows what it shares with the answer (team, role,
  era, batting hand) and unlocks a hint: the role, two of the card's standout stats, then a blurred
  photo. A close guess unlocks two. The daily card's format rotates through ODI, T20I, Test and IPL;
  practice lets you pick the format.

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # scoring logic + validation of every puzzle in the dataset
npm run build
```

## Data

`src/data/cricket.json`, `src/data/ballpark.json`, `src/data/cards.json` and `src/data/whoami.json` are generated; don't edit
them by hand. Sources:

| Source | Used for | Licence |
|---|---|---|
| [Cricsheet](https://cricsheet.org/) ball-by-ball data + register | IPL puzzles (complete, 2008 onward), player names and countries | [ODC-By 1.0](https://opendatacommons.org/licenses/by/1-0/) |
| Wikipedia record lists | International career/match records, World Cup timelines | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Wikidata | Full names for the few players Cricsheet only lists by initials | CC0 |
| Wikipedia (non-free files) | IPL franchise logos in `public/logos/ipl/` | Trademarks of their owners; used only to identify the teams |
| Wikipedia player infoboxes | Test, ODI and T20I career stats on the Showdown cards; roles, batting hands and career years for Who Am I? | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Player photos in `public/players/` | Showdown and Who Am I? cards | Each file's source and credit is in `scripts/data/player_photos.json` |

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
python3 scripts/data/gen_ballpark.py      # Cricsheet totals + worked sums + scripts/data/ballpark_manual.json -> src/data/ballpark.json
python3 scripts/data/gen_cards.py         # Showdown decks -> src/data/cards.json (add --refresh to re-fetch Wikipedia)
python3 scripts/data/gen_whoami.py        # Who Am I? bios and daily order -> src/data/whoami.json (after gen_cards.py)
npm test
```

`build.py` refuses to write a dataset with tied values, duplicate labels, a puzzle that starts
already solved, or a player name still in initials form. For the last one, add the full name to
`scripts/data/name_overrides.json` (keyed by Cricsheet identifier) after checking it.

`gen_ballpark.py` takes careers, records and crowds from `scripts/data/ballpark_manual.json` (each
checked against its linked page or Statsguru before it goes in; if a fact can't be sourced, the
question is reworded around one that can), works out the size-it-up sums and date spans from
sourced figures (the Laws' pitch, ball and stumps; the Equator; Everest) so the arithmetic can't
drift, and computes totals from Cricsheet: the IPL, and the 2011 World Cup, the most recent one
Cricsheet covers in full. It deals the questions into days of five with at most two of a family,
no shared topic, no question that gives another's answer away and at most one IPL question.

`gen_cards.py` builds one Showdown deck per format from the players listed in
`scripts/data/cards_players.json`. Test, ODI and T20I figures are read from the career table in each
player's Wikipedia infobox (cached in `data-raw/wiki/players/`), because Cricsheet's international
coverage starts in the 2000s; the IPL deck is computed from Cricsheet. Infoboxes of current players
lag a few matches behind, so each deck carries an "as of" date. Every stat is higher-wins. The script
fails if a player has no column for the format or two cards have identical stats. A card gets a
photo when `public/players/<name-in-lower-case-with-hyphens>.jpg` exists (the script lists the players
without one; they show initials on the team colour), so re-run it after adding photos.

`gen_whoami.py` reads `cards.json` and the same cached infoboxes and writes `src/data/whoami.json`:
each player's role (batter, bowler, all-rounder or wicketkeeper), batting hand, and the years of
their first and last match in each format they have a card for (the infobox's debut and last-match
rows; Cricsheet seasons for the IPL). The four infoboxes with no Role row are filled in from
`scripts/data/whoami_overrides.json`. It also sets the order each deck's cards come up as the daily,
arranged so nobody is the answer twice within 14 days. It never writes `cards.json`.
