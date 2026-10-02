# Lineup Lounge: new game mode ideas

Oct 2, 2026 · @Pk

## Summary

Build four modes next, in this order: **Ballpark** (quantity guessing), **Higher or Lower** (a survival streak), **Mystery Player** (Wordle-style player guessing) and **Grid** (Immaculate Grid for cricket). They fill the gaps in today's line-up: a pure estimation game, an endless quick-play game, a one-answer deduction puzzle and a recall puzzle that rewards obscure names. All four run on data the repo already generates (Cricsheet and Wikipedia), so none needs a backend.

Three more ideas are worth keeping for later: **Teammates** (a Travle-style chain between two players), **Worm** (guess the match from its run chart) and **Connections** (four hidden groups of four). The quantity mode has its own doc, *Lineup Lounge: quantity-guessing mode*.

## What makes these games work

The hits share one loop: a single puzzle a day that everyone gets, a few minutes to play, feedback after every guess, and a result you can share without spoiling it. What changes between them is the kind of thinking each guess asks for.

| Game | Daily puzzle | What each guess tells you | Score | Extra modes |
| --- | --- | --- | --- | --- |
| Wordle | One five-letter word, six guesses | Each letter: right spot, in the word, or not in it | Guesses used | None in the original |
| [Travle](https://travle.earth/extra_info) | Name every country on the land route between two countries | Green if the country gets you closer, orange for a near-shortest detour, red if it doesn't help | Guesses against the shortest path; you get a few spare (4 for a 3-country path, 8 for 13+) | Weekly challenge, practice archive |
| [Magnitudle](https://magnitudle.com/) | One estimation question, one guess | Only the reveal | How many orders of magnitude off; Size It Up gives 5 rounds of 100, full marks within 6% | Survival (keep going until a miss), Size It Up, Pop Culture, Geography, Weekly 1K |
| [Immaculate Grid](https://en.wikipedia.org/wiki/Immaculate_Grid) | 3×3 grid; each row and column is a team, stat or award | Right or wrong per square, one try each, no player twice | Squares filled, plus a rarity score for obscure answers | Copied for football, basketball, hockey and soccer within weeks |
| Connections | 16 words in four hidden groups of four | Whether your four belong together, or "one away" | Mistakes left, out of four | None |
| Worldle | Guess the country from its silhouette | Distance and direction to the answer | Guesses used | Bonus rounds after solving |
| [Stumple, Crickle and others](https://kingcricket.co.uk/?p=28323) | Guess a cricketer | Stumple: nationality, role, retired, birth year, batting hand, matches, IPL team | Guesses used | None |

Five patterns are worth copying:

- **Feedback that teaches.** Travle's colours and Stumple's attribute clues turn a wrong guess into progress. Lineup already does this with green, amber and red rows.
- **Score against a par.** Travle scores you against the shortest route, not a fixed number of guesses, so easy and hard days feel fair.
- **Reward depth.** Immaculate Grid's rarity score makes obscure answers worth more, which keeps experts playing.
- **One quick mode, one endless mode.** Magnitudle pairs its daily question with Survival, and Travle adds practice and a weekly, so there is always something to play after the daily.
- **A shareable grid.** Every one of them shares a result as coloured squares.

## Where Lineup Lounge stands

The three current modes cover ordering, recall and play against the computer. Missing are a single-answer deduction puzzle, an endless quick mode and a game that rewards knowing obscure players.

| Mode | Closest reference | What it asks | Daily | Gap it leaves |
| --- | --- | --- | --- | --- |
| Lineup | Wordle's feedback, applied to ordering | Put 5 items in order; 5 attempts, rows marked right, one off or wrong | Yes, plus practice by format | None; it is the core mode |
| Quiz | Trivia plus a little Magnitudle | 5 questions out of 500: 2 typed names, 3 number guesses scored by closeness | Yes, plus random practice | Number questions are stat recall with a linear margin, not estimation across orders of magnitude |
| Showdown | Top Trumps | 15 rounds of stat cards against the computer | No, free play | No daily, so no shared result |

The Quiz is already about 60% number questions (36 of 60). A separate quantity mode should therefore feel different: wider-ranging questions and scoring by orders of magnitude, not a bigger Quiz.

## Mode ideas

Seven modes, roughly in the order I would build them. Effort is S (days), M (about a week) or L (more), counting the data generator, the UI and tests.

### 1. Ballpark: quantity guessing

- **Plays:** a daily set of estimation questions, one guess each, such as "how many balls have been bowled in IPL history?". Answers range from tens to billions.
- **Scores:** by how close the guess is on a log scale, so being 2× off costs the same at 50 as at 5 million.
- **Data:** IPL and international aggregates from Cricsheet, plus hand-written, sourced questions.
- **Effort:** S–M, since the Quiz already has the number input, number line and closeness scoring.
- Full design in *Lineup Lounge: quantity-guessing mode*.

### 2. Higher or Lower: survival

- **Plays:** two player cards and one stat, say ODI hundreds. The first card's number shows; you say whether the second's is higher or lower. The winner stays on and a new card comes in.
- **Scores:** your streak until the first miss, like Magnitudle's Survival. A daily version deals everyone the same 10 pairs and shares as "8/10".
- **Data:** the Showdown decks in `cards.json` (342 cards across four formats). Skip pairs with equal values.
- **Effort:** S. It reuses `PlayerCard` and the deck loader, and gives Showdown's cards a quick daily.

### 3. Mystery Player: guess the cricketer

- **Plays:** guess the day's cricketer in 8 tries. Each typed name shows a row of clues: country, role, batting hand, bowling style, debut year and Test or ODI caps, with arrows for higher or lower.
- **Scores:** guesses used. Colours follow Lineup's: green for a match, amber for close (debut within 3 years, caps within 20%), red otherwise.
- **Data:** the Showdown player lists, with role, batting hand, bowling style and debut read from the same Wikipedia infoboxes `gen_cards.py` already fetches.
- **Effort:** M. Autocomplete (`AnswerInput`) and the share grid already exist; the work is the extra infobox fields.

### 4. Grid: cricket's Immaculate Grid

- **Plays:** a 3×3 grid. Rows and columns are IPL franchises, countries or milestones, such as "took an IPL five-for" or "played the 2008 season". Name a player who fits each square; one try per square, no player twice.
- **Scores:** squares filled out of 9, plus a rarity bonus. With no backend, rarity can come from the data: an answer with fewer IPL matches, or one of few valid players, is rarer.
- **Data:** Cricsheet IPL gives every player's franchise and season. The generator only keeps grids where every square has at least 3 valid answers.
- **Effort:** M–L. Start with IPL only; international grids need Test and ODI squad data that Cricsheet doesn't fully cover.

### 5. Teammates: a Travle for players

- **Plays:** link two players through a chain of IPL teammates, for example Sachin Tendulkar to Shubman Gill. Each name must have played in the same XI as the one before.
- **Scores:** names used against the shortest chain, with Travle's spare guesses. Green if a name gets you closer, red if it doesn't.
- **Data:** playing XIs per match from Cricsheet IPL; shortest paths are computed at build time.
- **Effort:** L. The graph is easy; showing progress when there are many valid chains is the hard part.

### 6. Worm: guess the match

- **Plays:** a famous match's run chart (runs per over for both innings), with no labels. Guess the two teams, then the year.
- **Scores:** 100 for the teams on the first try, then year points by closeness, as in the Quiz.
- **Data:** Cricsheet ball-by-ball, with a hand-picked list of memorable matches.
- **Effort:** M. It is the most visual idea, but too hard for casual players unless the matches are famous.

### 7. Connections: four groups of four

- **Plays:** 16 names. Find the four groups, such as "IPL title-winning captains", "left-arm wrist-spinners" or "played for four or more IPL franchises".
- **Scores:** mistakes left, out of four.
- **Data:** groups computed from Cricsheet where possible; the rest hand-written and sourced, as the Quiz rules require.
- **Effort:** M for the UI, with ongoing work to keep the groups clever. It needs a new puzzle every day, so most groups must be generated.

Also worth adding: a **weekly challenge** (a harder set every Monday, like Travle and Magnitudle's Weekly 1K) and an **archive** of past dailies. Each builds on the modes above rather than being a mode of its own.

## Recommended order

&#91;embedded content: seven modes by effort and payoff · filled = build next\]

Positions are my judgement from the effort estimates above, not measurements. Filled dots are the four to build next.

1. **Ballpark.** Closest to the Magnitudle idea, and most of the scoring and input code exists.
2. **Higher or Lower.** The fastest win: a few days of work gives Showdown's cards a daily and an endless mode.
3. **Mystery Player.** The most Wordle-like daily and the strongest share grid; needs a few more infobox fields per player.
4. **Grid.** The best game for experts, built on IPL data alone at first.
5. **Teammates, Connections, Worm.** Revisit once the first four show which kinds of play people return to.

## Open questions

- [ ] Should every new mode have a daily, or are some free play like Showdown? A daily is what makes the shareable result.
- [ ] Are IPL-only versions acceptable for Grid and Teammates at launch? International squad data is patchier.
- [ ] Is a rarity score from match counts good enough, given there is no backend to count what other players answered?
- [ ] How many modes should the home screen show before it needs grouping (for example Daily and Free play)?
- [ ] Do we want a weekly challenge and an archive now, or after the new modes?

## Sources

- [Travle rules](https://travle.earth/extra_info): connections, guess allowance, colours, modes.
- [Magnitudle](https://magnitudle.com/): Daily, Survival, Size It Up and Weekly 1K modes; 5 rounds of 100 points.
- [Immaculate Grid on Wikipedia](https://en.wikipedia.org/wiki/Immaculate_Grid): rules, rarity score, spin-offs.
- [King Cricket on cricket Wordles](https://kingcricket.co.uk/?p=28323): Crickle, Nurdle, Crickdle, Stumple (from the search summary; the page refused a direct fetch).
- Wordle, Connections and Worldle are described from general knowledge, not a page opened for this doc.
