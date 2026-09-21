# IELTS Liz — Academic Writing Deep Research (for revision-app agents)

## Metadata

| Field | Value |
|---|---|
| Document ID | `ieltsliz-writing-academic-deep-research` |
| Crawl date | 2026-09-21 |
| Source site | https://ieltsliz.com/ (author: Elizabeth "Liz" Ferguson, IELTS teacher since 2008) |
| Scope | **IELTS Academic Writing only** — Task 1 (Academic report) + Task 2 (essays, shared with GT) + scoring, word-count, computer-delivered-test rules. GT Task 1 letters and Listening/Reading/Speaking pages are out of scope. |
| Intended consumer | Agents building: (a) Task 1 visual/graph generator, (b) Task 2 prompt generator, (c) auto-grader with Band 6/7/8 feedback, (d) computer-IELTS simulation (timer, plain box, no spellcheck, live word count). |
| Method | BFS crawl from 9 seed URLs on ieltsliz.com (Task 1 hub, Task 2 hub, essay-types, two band-score pages, writing-scoring, computer pros/cons, 100 essay questions). Depth ≤2 crawl (163 pages) plus 102 curated supplemental URLs (264 unique pages after de-duplication, fetched and text-extracted, 1.14 M characters). All internal links in the corpus re-checked by HTTP (242 unique writing URLs HTTP 200; 13 dead links logged). |
| Verification | Every claim below is sourced from a specific ieltsliz.com URL (linked inline, full index in Appendix A). Band-descriptor tables are **paraphrases** of the public IELTS descriptors that Liz cites on her scoring pages. |
| Copyright / fair use | Not affiliated with IELTS Liz or Elizabeth Ferguson. This is a **fair-use research summary for internal app design**: prose is paraphrased; direct quotes are capped at **≤25 words** and always linked; **no model essay or model report is reproduced in full**; **no images are embedded or hotlinked** (chart images on the site are referenced only as "image on page"). Copyright © Elizabeth Ferguson, 2014–2026, all rights reserved. If any quotation or paraphrase is ever surfaced to end users, attribute and link to the source page. |
| Known limits | Many Task 1 charts and several band-descriptor grids exist only as **images** on the site, so only their surrounding text/tips are captured. Reported exam questions are student recollections, not official IELTS material. |

## Table of Contents

1. Site map of Writing sections crawled
2. Test rules (60 min, 20+40 split, 150/250 minima, 170–190 / 270–290 targets, word-count rules)
3. Task 1 Academic — 7 types (line/bar/pie/table/map/process/mixed): cues, structure, key-feature selection, grouping
4. Task 1 language banks (trends, degree, time, comparison, proportion, approximating, maps, process, tenses + number rules)
5. Task 1 model-answer patterns (8 patterns: 7 task types + mixed/7b, short quotes + URL each)
6. Task 2 — 10 instruction variants grouped into 5 families
7. Task 2 skeletons + paragraph recipes (4–5 paras, intro 40–50w, bodies 95w/65w, conclusion 30–40w, 5-min plan)
8. Task 2 ideas + vocabulary per topic (20 topics, collocations, linkers, uncountables, banned phrases)
9. Marking criteria — 4 pillars × Bands 6/7/8/9, weighting, rounding, score caps
10. Grading-feedback design (feedback starters per criterion with `evidenceSpan` slots)
11. Prompt / graph generation schemas (JSON)
12. Mistakes & FAQ (30 Task 1 mistakes, Task 2 biggest mistakes, computer-test FAQ)
13. Gaps, contradictions, outdated notes and link-rot
- Appendix A: Full URL index (all absolute URLs)
- Appendix B: Glossary

---

## 1. Site map of Writing sections crawled

Two site hubs carry the whole Academic Writing curriculum:
- **Task 1 hub:** [ielts-writing-task-1-lessons-and-tips](https://ieltsliz.com/ielts-writing-task-1-lessons-and-tips/) — overview, 6 task types + "combination", model-answer index, 20 practice lessons, GT section at bottom (out of scope).
- **Task 2 hub:** [ielts-writing-task-2](https://ieltsliz.com/ielts-writing-task-2/) — test info, practice questions, tips, 13 model essays, 34 practice lessons, topic/ideas links.

| Category | What it covers | Key entry URLs | Crawled pages |
|---|---|---|---|
| **Task 1 hubs & FAQ** | Test overview, paragraph formula, FAQ list | [/ielts-writing-task-1-lessons-and-tips/](https://ieltsliz.com/ielts-writing-task-1-lessons-and-tips/) · [/ielts-writing-task-1-faq/](https://ieltsliz.com/ielts-writing-task-1-faq/) · [/ielts-writing-task-1/](https://ieltsliz.com/ielts-writing-task-1/) (2017 answer page) | 3 |
| **Task 1 structure & skills** | Report structure, paragraphing, intro, overview vs conclusion, preparation, organisation | [/writing-task-1-report-structure/](https://ieltsliz.com/writing-task-1-report-structure/) · [/writing-task-1-paragraphs/](https://ieltsliz.com/writing-task-1-paragraphs/) · [/ielts-tips-conclusion-or-overview-for-writing-task-1/](https://ieltsliz.com/ielts-tips-conclusion-or-overview-for-writing-task-1/) · [/answers-to-organising-bar-chart-paragraphs/](https://ieltsliz.com/answers-to-organising-bar-chart-paragraphs/) | 43 lessons incl. language |
| **Task 1 language** | Line-graph vocab, accurate data, tenses/grammar, map language, sentence structures, synonyms | [/ielts-line-graph-vocabulary/](https://ieltsliz.com/ielts-line-graph-vocabulary/) · [/vocabulary-for-accurate-data/](https://ieltsliz.com/vocabulary-for-accurate-data/) · [/what-tense-to-use-in-ielts-writing-task-1/](https://ieltsliz.com/what-tense-to-use-in-ielts-writing-task-1/) · [/ielts-maps-vocabulary/](https://ieltsliz.com/ielts-maps-vocabulary/) · [/ielts-writing-task-1-line-graph-sentences/](https://ieltsliz.com/ielts-writing-task-1-line-graph-sentences/) | (in 43 above) |
| **Task 1 model answers** | 26 model pages across all 7 types (band 9 target) | [/ielts-writing-task-1-lessons-and-tips/](https://ieltsliz.com/ielts-writing-task-1-lessons-and-tips/) is the index; representative: [/ielts-writing-task-1-line-graph-model-score-9/](https://ieltsliz.com/ielts-writing-task-1-line-graph-model-score-9/) · [/ielts-pie-chart-task-1-model-score-9/](https://ieltsliz.com/ielts-pie-chart-task-1-model-score-9/) · [/ielts-map-model-answer/](https://ieltsliz.com/ielts-map-model-answer/) · [/ielts-diagram/](https://ieltsliz.com/ielts-diagram/) | 28 |
| **Task 1 sample practice charts** | Inventory of practice tasks (bar/line/table/pie/diagram/map/multiple) | [/ielts-sample-chart-for-writing-task-1/](https://ieltsliz.com/ielts-sample-chart-for-writing-task-1/) | 1 (hub) |
| **Task 2 hubs & model essays** | 13 model essays, one per essay type | [/ielts-writing-task-2/](https://ieltsliz.com/ielts-writing-task-2/) is the index; e.g. [/ielts-discussion-essay-model-answer/](https://ieltsliz.com/ielts-discussion-essay-model-answer/) · [/ielts-agree-disagree-essay-sample-answer/](https://ieltsliz.com/ielts-agree-disagree-essay-sample-answer/) · [/ielts-advantage-disadvantage-model-essay/](https://ieltsliz.com/ielts-advantage-disadvantage-model-essay/) · [/ielts-solution-essay-band-9-model-answer/](https://ieltsliz.com/ielts-solution-essay-band-9-model-answer/) · [/ielts-model-essay-score-9/](https://ieltsliz.com/ielts-model-essay-score-9/) | 27 |
| **Task 2 skills & structure** | Essay types, introductions, thesis, opinion rules, planning, paragraphing, conclusions, paraphrasing, linking, sentence work, banned sentences | [/types-of-ielts-essays/](https://ieltsliz.com/types-of-ielts-essays/) · [/ielts-writing-task-2-how-to-write-an-introduction/](https://ieltsliz.com/ielts-writing-task-2-how-to-write-an-introduction/) · [/how-many-paragraphs-for-an-ielts-essay/](https://ieltsliz.com/how-many-paragraphs-for-an-ielts-essay/) · [/ielts-writing-task-2-should-i-give-my-opinion/](https://ieltsliz.com/ielts-writing-task-2-should-i-give-my-opinion/) · [/linking-words-for-writing/](https://ieltsliz.com/linking-words-for-writing/) · [/ielts-writing-tips-sentences-to-avoid/](https://ieltsliz.com/ielts-writing-tips-sentences-to-avoid/) | 68 |
| **Task 2 instruction/type pages** | Sample questions per essay type, instruction analysis | [/opinion-essay-sample-questions/](https://ieltsliz.com/opinion-essay-sample-questions/) · [/discussion-essay-sample-questions/](https://ieltsliz.com/discussion-essay-sample-questions/) · [/ielts-advantage-disadvantage-sample-essay-questions/](https://ieltsliz.com/ielts-advantage-disadvantage-sample-essay-questions/) · [/ielts-solution-essay-sample-questions/](https://ieltsliz.com/ielts-solution-essay-sample-questions/) · [/ielts-direct-questions-sample-essay-titles/](https://ieltsliz.com/ielts-direct-questions-sample-essay-titles/) · [/ielts-essay-instructions-agree-disagree-to-what-extent/](https://ieltsliz.com/ielts-essay-instructions-agree-disagree-to-what-extent/) | 16 |
| **Task 2 question banks** | 100+ questions by topic and by essay type; yearly predicted topic lists (2021–2026) | [/100-ielts-essay-questions/](https://ieltsliz.com/100-ielts-essay-questions/) · [/ielts-essay-topics-for-2026/](https://ieltsliz.com/ielts-essay-topics-for-2026/) · [/common-essay-topics-for-ielts/](https://ieltsliz.com/common-essay-topics-for-ielts/) | 22 topic pages + 2026 list |
| **Task 2 idea/vocabulary pages** | Topic idea banks (tourism, technology, environment, etc.) | [/tourism-and-the-local-community/](https://ieltsliz.com/tourism-and-the-local-community/) · [/technology-topic-for-writing-task-2/](https://ieltsliz.com/technology-topic-for-writing-task-2/) · [/the-environment-topic-for-writing-task-2/](https://ieltsliz.com/the-environment-topic-for-writing-task-2/) · [/ideas-ielts-essays-ideas-ielts-speaking/](https://ieltsliz.com/ideas-ielts-essays-ideas-ielts-speaking/) | 12 |
| **Scoring & band scores** | Marking criteria with band-by-band tips + calculation examples | [/ielts-writing-task-1-band-scores/](https://ieltsliz.com/ielts-writing-task-1-band-scores/) · [/ielts-writing-task-2-band-scores-5-to-8/](https://ieltsliz.com/ielts-writing-task-2-band-scores-5-to-8/) · [/ielts-writing-scoring/](https://ieltsliz.com/ielts-writing-scoring/) · [/ielts-writing-task-2-band-descriptors/](https://ieltsliz.com/ielts-writing-task-2-band-descriptors/) | 4 |
| **Rules, word count, computer test** | Word counting, length targets, under-count penalty, answer sheet, CBT pros/cons | [/how-many-words-ielts-writing/](https://ieltsliz.com/how-many-words-ielts-writing/) · [/ielts-tips-how-words-are-counted/](https://ieltsliz.com/ielts-tips-how-words-are-counted/) · [/ielts-penalty-for-writing-under-word-count/](https://ieltsliz.com/ielts-penalty-for-writing-under-word-count/) · [/computer-delivered-ielts-pros-cons/](https://ieltsliz.com/computer-delivered-ielts-pros-cons/) · [/ielts-answer-sheet-writing/](https://ieltsliz.com/ielts-answer-sheet-writing/) | 19 |
| **Vocabulary support** | Uncountable nouns, country articles, topic vocabulary | [/uncountable-nouns-word-list/](https://ieltsliz.com/uncountable-nouns-word-list/) · [/practice-with-uncountable-nouns/](https://ieltsliz.com/practice-with-uncountable-nouns/) | 2+ |
| **GT contrast (context only)** | Academic report vs GT letter; T2 is shared | [/ielts-gt-academic-writing-differences/](https://ieltsliz.com/ielts-gt-academic-writing-differences/) | 1 |

**Coverage check against the brief:** Task 1 pages ≈ 61 writing pages (≥65 task-1-related URLs counting lesson variants in Appendix A), Task 2 pages ≈ 105 writing pages, scoring/computer pages ≈ 23. The parallel-crawl assumption (~65 T1 + ~45 T2 + scoring/computer) is met or exceeded.

**Implication for app:** the site cleanly separates T1 lesson/language/model layers and T2 family/marking layers, so the app's content model can mirror that: `t1.spec → t1.pattern → t1.language` and `t2.prompt → t2.family → t2.rubric`.

---

## 2. Test rules

Source of record: [Task 1 hub](https://ieltsliz.com/ielts-writing-task-1-lessons-and-tips/), [Task 2 hub](https://ieltsliz.com/ielts-writing-task-2/), [how-many-words](https://ieltsliz.com/how-many-words-ielts-writing/), [how words are counted](https://ieltsliz.com/ielts-tips-how-words-are-counted/), [writing scoring](https://ieltsliz.com/ielts-writing-scoring/).

### 2.1 Timing and task split

| Rule | Value | Notes (Liz) |
|---|---|---|
| Total writing time | **60 minutes**, self-managed | Nobody tells you when to switch; you may do Task 2 first |
| Recommended Task 1 time | **20 minutes** | "IELTS recommend no more than 20 mins" |
| Recommended Task 2 time | **40 minutes** | Task 2 is where most marks are |
| Task weighting | **T2 = 2 × T1** | T1 ≈ 33% of writing marks; T2 ≈ 66% |
| Overall writing band | average of the 2 task scores with T2 doubled, rounded | T1 8 + T2 6 → **6.5** (Liz's worked example) |
| Within-task scoring | 4 criteria × 25% each | T1: TA, CC, LR, GRA. T2: TR, CC, LR, GRA |

### 2.2 Minimums, targets and ceilings

| Task | Minimum (instruction wording) | Recommended target | Ceiling advice |
|---|---|---|---|
| Task 1 Academic | "Write **at least 150** words" — must go over 150 | **170–190 words** | Try not to exceed 200; 210 max only for a very complex/multiple chart |
| Task 2 | "Write **at least 250** words" — must go over 250 | **270–290 words** | Try not to exceed 300; longer ≠ better, padding lowers relevance |

- Task 1 is a **report, not an essay** → no conclusion; an **overview is compulsory**.
- Task 2 is a **formal essay** → introduction + 2–3 body paragraphs + **conclusion is compulsory**.
- Do **not** write the essay title on the answer sheet; the first line is your essay.

### 2.3 Word-count rules (how the examiner counts)

| # | Rule | Example / count |
|---|---|---|
| 1 | Numbers, dates, times count as words in **writing** | `30,000` = 1; `9.30am` = 1; `12.06.2016` = 1 |
| 2 | "Six million" = **two** words | (Compare "6 million" = number + word) |
| 3 | Symbols with numbers are **not** counted | `55%` = one number; "55 percent" = one word + one number |
| 4 | Every small word counts | articles `a/an/the`, prepositions `in/at`, repeated words all count |
| 5 | Hyphenated words = **one** word | `up-to-date` = 1; "over a ten-year period" keeps the hyphen and "year" has no *s* |
| 6 | Compound nouns written as one word = 1; as two words = 2 | `blackboard` = 1; `university bookshop` = 2 |
| 7 | Words in **brackets count** — brackets are allowed in Writing T1 | "…by electricity (55%)." = 9 words |
| 8 | Contractions | `it's` = 1; `it is` = 2 |
| 9 | **Copied words are not counted** | If you copy the question wording, the examiner ignores it for the count |
| 10 | No upper limit | But a longer essay adds unfocused/irrelevant sentences that lower the score |

### 2.4 Penalties, validity and response caps (writing)

| Situation | Consequence | Source |
|---|---|---|
| Under word count (T1 <150 / T2 <250) | **Fixed band-5 penalty has been removed**, but under-length writing cannot develop ideas → lower TR/TA | [penalty page](https://ieltsliz.com/ielts-penalty-for-writing-under-word-count/) |
| Memorised answer | Essay may not be accepted; **could result in band 0** | [penalty page](https://ieltsliz.com/ielts-penalty-for-writing-under-word-count/) |
| Answering only half the question | Cannot score above **band 5 in TR** | [penalty page](https://ieltsliz.com/ielts-penalty-for-writing-under-word-count/) |
| No conclusion (T2) | **Below band 6 in Task Response** (25% of marks) | [conclusion page](https://ieltsliz.com/is-a-conclusion-important-in-ielts-writing-task-2/) |
| No overview (T1) | **Band 5 or below in Task Achievement** | [overview page](https://ieltsliz.com/is-the-overview-important-in-ielts-wt1-answers/) |
| One body paragraph (T2) | ≈ **band 5 Coherence & Cohesion** | [paragraphs page](https://ieltsliz.com/how-many-paragraphs-for-an-ielts-essay/) |
| Illegible handwriting | Band score can be **seriously affected** | [penalty page](https://ieltsliz.com/ielts-penalty-for-writing-under-word-count/) |
| Very short essay even without a fixed penalty | Ideas "limited and not sufficiently developed" = band 5 TR wording | [penalty page](https://ieltsliz.com/ielts-penalty-for-writing-under-word-count/) |

### 2.5 Mechanics

- Pen **or** pencil is allowed ([T2 FAQ](https://ieltsliz.com/ielts-writing-task-2-faq/)).
- Spelling is marked (Lexical Resource); punctuation is marked (Grammar) — prefer commas and full stops, and avoid `;` and `:`.
- Extra answer paper can be requested by raising your hand.
- Practice on the official answer sheet to learn "lines ≈ words" ([answer-sheet lesson](https://ieltsliz.com/ielts-answer-sheet-writing/)).
- GT difference (context): GT Task 1 is a **letter**, Academic Task 1 is a **chart report**; T2 is effectively identical in task, length, timing and marking ([GT differences](https://ieltsliz.com/ielts-gt-academic-writing-differences/)).

**Implication for app:** hard-code 20/40, 150/250 minima, 170–190 and 270–290 targets in the session engine; count words with the IELTS rules above (numbers, %, brackets, hyphens) instead of a naïve whitespace split, and never count text copied from the prompt.

---

## 3. Task 1 Academic — the 7 types

Sources: [Task 1 hub type descriptions](https://ieltsliz.com/ielts-writing-task-1-lessons-and-tips/), [sample charts inventory](https://ieltsliz.com/ielts-sample-chart-for-writing-task-1/), [report structure](https://ieltsliz.com/writing-task-1-report-structure/), [organisation answers](https://ieltsliz.com/answers-to-organising-bar-chart-paragraphs/), [pie step-by-step](https://ieltsliz.com/how-to-ielts-pie-chart-lesson/), [diagram organisation](https://ieltsliz.com/ielts-diagram-paragraphs-and-organisation/), [map model](https://ieltsliz.com/ielts-map-model-answer/), [multiple charts](https://ieltsliz.com/ielts-writing-task-1-multiple-charts/).

### 3.0 Universal report formula (all 7 types)

| Paragraph | Job | Content rules |
|---|---|---|
| **Introduction** | Paraphrase the question statement; add categories/units/dates | 1–2 sentences; never copy; keep chart nouns ("bar chart" stays "bar chart"); give precise years; "Units are measured in …" |
| **Overview** | Collect **all key features** in one place; start with **"Overall,"** | Most important paragraph; marked in TA; never split features across paragraphs; needed even for maps/diagrams/mixed |
| **Body 1** | Detail group A with data | Topic sentence + data (numbers/dates) in every sentence |
| **Body 2** | Detail group B with data | Same; body 3 is optional and uncommon (mixed charts only) |
| **Conclusion** | — | **Not needed** in Task 1; overview ≠ conclusion |

Hard paragraph rules ([organisation answers](https://ieltsliz.com/answers-to-organising-bar-chart-paragraphs/)): never one body paragraph; never four or more body paragraphs; body paragraphs need not be equal length (it's a report, not an essay).

### 3.1 Type-by-type cues, key features and grouping

| Type | Prompt cues (verbs/nouns) | What you must describe | Typical key features | Best grouping for bodies | Tense |
|---|---|---|---|---|---|
| **Line graph** | "line graph shows … over the period … from 19xx to 20xx" | Trends of 2–4+ lines over time | start/end levels, peaks, lows, overall direction, crossovers, biggest change | by line similarity (risers vs fallers) or by magnitude (highest vs rest) | past / future / present if no dates |
| **Bar chart** | "bar chart shows … in [years/countries]" | Comparisons across categories (often 2 groups, e.g. men/women) | highest & lowest categories, biggest/smallest gender or group gap | **Option A:** categories that increased vs decreased vs fluctuated. **Option B:** highest+lowest first, then all others | past (or present/future if dated) |
| **Pie chart** | "pie charts show the proportion of …" | Proportions of a whole, often 2+ years | dominant slice, smallest slice, big risers/fallers, slices that hardly changed | don't describe pie-by-pie; group by "biggest/most stable" vs "changed most" | per dates |
| **Table** | "table gives information about …" | Many categories × rows; compare and/or change over time | highest/lowest cells, biggest growth, total/percentage shifts | by rows that rose vs fell, or by highest vs lowest | per dates; future tables → future forms |
| **Map** | "maps show … in 19xx and today"; before/after; floor plan | Location, position, layout, change over time | size growth, new infrastructure, new housing/facilities, things removed, merger of towns | by area (north/south) or by type of change (infrastructure vs housing) | present perfect for "from past until now"; past for completed; future if planned |
| **Process / diagram** | "diagram illustrates how … is made/works"; cycle | Stages and steps in order; cycles return to start | number of stages, start/end (or cyclical), main equipment/inputs/outputs | body A = first half of stages, body B = second half (never one paragraph) | present simple passive; active where natural (water "goes", "travels") |
| **Mixed (2–3 charts)** | two charts/tables in one task | Key features of **both** charts in one report | one feature set per chart; a link between charts if any | one body paragraph per chart (or per data block); overview must cover both | per each chart's dates |

### 3.2 Key-feature selection checklist (drives the overview)

- [ ] Identify the **highest** and **lowest** item(s) (in every year if multiple years).
- [ ] Identify the **biggest increase** and **biggest decrease** (or biggest difference between groups).
- [ ] Identify things that **stayed the same** / barely changed.
- [ ] Identify any **crossover** or ranking change over time.
- [ ] For maps: changes in **size**, **infrastructure**, **housing**, **facilities**, **industry**.
- [ ] For diagrams: the **stages** and whether it is a **cycle**.
- [ ] For mixed: one key feature per chart plus any relationship.
- [ ] Keep all of these in **one** overview; do not scatter them.

### 3.3 Grouping principles for body paragraphs

1. Choose **one simple, logical system** per task and make it visible to the examiner.
2. Prefer grouping by **pattern** (increase / decrease / fluctuate) for time-series data.
3. Or group by **magnitude** (highest + lowest in one body; the rest in the other).
4. For comparisons: group by **who/what is being compared** so each sentence can compare inside a category.
5. For cumulative/multi-chart tasks: split bodies **by chart**, not by random data points.
6. Add a **linker that signals the group** (e.g. "In contrast," / "Similarly,") and keep the order logical from biggest to smallest or earliest to latest.
7. Both grouping options are "excellent" if they highlight key features and read logically ([Liz, organisation answers](https://ieltsliz.com/answers-to-organising-bar-chart-paragraphs/)).

### 3.4 Mixed-task specifics

- Intro must introduce **both** tasks; one **single** overview covering both.
- Bodies split between tasks; use language appropriate to each chart type.
- Word discipline: try to stay ≤200 words; select key features without dropping whole categories; too much detail lowers the score.
- Liz's mixed models run **194–204 words**, with a note that up to ~210 is acceptable for information-heavy tasks ([multiple charts](https://ieltsliz.com/ielts-writing-task-1-multiple-charts/)).

**Implication for app:** store `type` and `groupingStrategy` on every generated chart; validate the user report against a per-type checklist (overview present? all key features? data in every body sentence? no conclusion?).

---

## 4. Task 1 language banks

Main sources: [line-graph vocabulary](https://ieltsliz.com/ielts-line-graph-vocabulary/), [vocabulary for accurate data](https://ieltsliz.com/vocabulary-for-accurate-data/), [tenses & grammar](https://ieltsliz.com/what-tense-to-use-in-ielts-writing-task-1/), [map vocabulary](https://ieltsliz.com/ielts-maps-vocabulary/), [4 complex sentences](https://ieltsliz.com/ielts-writing-task-1-line-graph-sentences/), [pie lesson language](https://ieltsliz.com/how-to-ielts-pie-chart-lesson/), [linking words](https://ieltsliz.com/linking-words-for-writing/).

### 4.1 Trends — verbs/nouns (use both forms for flexibility)

| Direction | Verb | Noun | Past form |
|---|---|---|---|
| Up | rise, increase, climb, grow, go up | a rise, an increase, a climb, a growth | rose, increased, climbed, grew, went up |
| Down | decrease, drop, fall, decline, go down | a decrease, a drop, a fall, a decline | decreased, dropped, fell, declined, went down |
| Flat | remain steady/stable/unchanged, level off, plateau | — | remained steady |
| Irregular | fluctuate, dip | a fluctuation, a dip | fluctuated, dipped |
| Extreme up | rocket, soar (only for truly dramatic rises) | — | rocketed, soared |
| Peaks/lows | peak at, hit a high/low of, bottom out | a peak of, a high of, a low of | peaked at |

Preposition rule: **to peak at** / **a peak of** (verb + *at*, noun + *of*).

### 4.2 Degree — adverbs (with verbs) vs adjectives (with nouns)

| Strength | Adverb | Adjective | Meaning cue |
|---|---|---|---|
| Gradual | steadily, gradually, eventually | steady, gradual | change took a long time |
| Small | slightly, marginally, relatively | slight, marginal, minimal | tiny change |
| Large | significantly, considerably | considerable, significant | big change |
| Fast/large | rapidly, dramatically | rapid, steep, dramatic | big change over a short period |

Pattern rule: **verb + adverb** ("increased steadily") vs **adjective + noun** ("a steady increase").

### 4.3 Time phrases

over the next three days · three days later · after three days · over the following three days · the next three days show · from … to … / between … and … · the first year / initially · the last year / the final year · over the period / the given period · at the beginning of the period · at the end of the period · over a ten-year period.

Grammar notes: article required ("**a** ten-year period"), "year" stays singular, hyphen in "ten-year".

### 4.4 Comparison & linking (Task 1 body paragraphs)

| Function | Language |
|---|---|
| Contrast | while, whereas, in contrast, by contrast, on the other hand, compared to, in comparison with, as opposed to |
| Similarity | similarly, likewise, in the same way, both, respectively |
| Addition | in addition, furthermore, moreover, also |
| Sequence (diagrams) | first, next, then, after that, subsequently, finally |
| Overview opener | Overall, … (Liz: "the most appropriate linker" for the overview) |

### 4.5 Proportion & data language

| Idea | Options |
|---|---|
| Show a share | account for, comprise, make up, constitute, represent (e.g. "oil accounted for 42%") |
| Compare shares | "twice as much as", "half of", "a third of", "the majority of", "a minority of" |
| Rank | the main/largest source, the second largest, the least/fewest, the most popular |
| Difference | fell **by** 1% (size of change) vs fell **to** a quarter (end point) |
| Precision | "the figure stood at", "the number reached", "the proportion remained constant at" |

### 4.6 Approximating (accuracy without inventing numbers)

Two groups are needed because chart data is read visually:

| Group | Words |
|---|---|
| Under / about-below | under, below, less than, just under, slightly under, nearly, almost, close to, well under, considerably less than |
| About | about, approximately, around |
| Over / above | over, above, more than, just over, slightly over, marginally above, well over, considerably more than |

Liz's accuracy rule: if the bar only shows "just under 30%", do **not** write 28% — write "just under 30%" ([video summary](https://ieltsliz.com/vocabulary-for-accurate-data/)).

### 4.7 Map location & change

| Function | Language |
|---|---|
| Direction | north, south, east, west, north-east, south-east, north-west, south-west |
| Location | X is located in the north-east of the town · X is situated … · lies … · is just outside the housing area |
| Features | the railway/main road runs through / crosses / passes through / goes through Y · housing area = residential area |
| Population | The population of Y is 60,000 · Y has a population of 60,000 |
| Change | was built / constructed / demolished / replaced by / extended / converted into; there has been considerable development |
| Paraphrase care | Do **not** upgrade "town" to "city"; "road" ≠ "street" |

### 4.8 Process / diagram language

- **Passive**: is collected, is transferred, is filtered, is treated, is stored, is delivered.
- **Sequencing**: first, then, next, after this, subsequently, finally; "the process begins with …", "the final stage is …".
- **Cycle language**: "the cycle repeats", "returns to the starting point", "the process is continuous/continual".
- **Mixed voice is normal**: "Rain is collected as it falls…" then "This water then passes through the drains…" ([tenses page](https://ieltsliz.com/what-tense-to-use-in-ielts-writing-task-1/)).

### 4.9 Tense decision table

| Chart information | Tense/form |
|---|---|
| Dates in the past | past simple (rose, fell, stood at) |
| Dates in the future | future forms (is predicted/forecast/projected to; will) |
| Past → future span | past simple **and** future forms in the same report |
| No date at all | present simple |
| Map "from 1962 until now" | present perfect ("there has been considerable development") |
| Process/diagram | present simple (passive/active as appropriate) |

Do **not** force passive voice into bar/line/pie/table tasks — Liz notes most such tasks won't use it and forcing it "will probably result in an error".

### 4.10 Number, amount and ratio rules

| Rule | Correct | Wrong |
|---|---|---|
| Countable vs uncountable | the **number of** students; the **amount of** money; the **proportion/percentage of** | "the amount of students" |
| Percentages | 55% (symbol not counted) or 55 percent (2 units) | — |
| Millions | "six million" = 2 words; "6 million" = number + word; "the population is given in millions" | "6 millions" |
| Ratios/fractions | a third, a quarter, half of, twice the number | "a half of the number" (prefer "half of") |
| Articles with countries | the UK, the US, the Philippines; Britain/England/France with **no** "the" | the America, the Britain, the England |
| Nationalities as groups | the British, the English, the Americans | — |

### 4.11 Three model complex sentences (line graph)

From [line graph sentences](https://ieltsliz.com/ielts-writing-task-1-line-graph-sentences/) — each pattern carries subject + verb + movement + numbers + dates. Items 1–2 are quoted verbatim (≤25 words each); item 3 is an owned variant of the same data:

1. `"Between 2004 and 2007, the number of people becoming vegetarian increased steadily from about 75 to 200."` — date-first pattern ([source](https://ieltsliz.com/ielts-writing-task-1-line-graph-sentences/)).
2. `"There was a steady increase in the number of people becoming vegetarian from about 75 to 200 between 2004 and 2007."` — noun-form ("there was a steady increase in…") pattern ([source](https://ieltsliz.com/ielts-writing-task-1-line-graph-sentences/)).
3. Owned variant (same data, "figure witnessed" family): `The figure for people turning vegetarian witnessed a steady rise, climbing from about 75 in 2004 to 200 in 2007.`

**Implication for app:** build a `languageBank` table keyed by function (trend/degree/time/compare/proportion/approximate/map/process/tense) and use it both for hinting during writing and for error tagging in grading (e.g. "amount of students" → uncountable error).

---

## 5. Task 1 model-answer patterns (8 patterns: 7 task types + mixed/7b)

Rules of use: patterns only; no model report is reproduced here. Each row gives the skeleton Liz's band-9 models follow plus a **≤25-word** illustrative fragment from the model page.

| # | Pattern (type) | Paragraph skeleton | Illustrative fragment (≤25 words) | Source |
|---|---|---|---|---|
| 1 | **Line graph (2–3 lines)** | Intro (paraphrase + dates) → Overview (direction per line + start/end leader) → Body 1 (line A + line B data) → Body 2 (line C + any crossover) | "Overall, the consumption of margarine and butter decreased over the period given, while for low fat and reduced spreads, it rose." | [line graph model](https://ieltsliz.com/ielts-writing-task-1-line-graph-model-score-9/) |
| 2 | **Bar chart (2 groups × categories)** | Intro (+ units) → Overview (biggest gap + overall leader) → Body 1 (leader + extremes with figures) → Body 2 (remaining categories, biggest gap) | "Overall, the UK spent more money on consumer goods than France in the period given." | [bar chart model](https://ieltsliz.com/ielts-model-bar-chart-band-score-9/) |
| 3 | **Bar chart over time** | Intro → Overview (leader over time + country trends) → Body 1 (risers with figures) → Body 2 (faller/stable + peak detail) | "Overall, the US produced the most wind energy over the period given except in the final year when Denmark produced the most." | [2023 bar chart](https://ieltsliz.com/ielts-bar-chart-model-answer-2023/) |
| 4 | **Pie charts (2 years)** | Intro (list sources + both years) → Overview (dominant group + risers/fallers) → Body 1 (dominant + smallest with % both years) → Body 2 (the rest, by direction of change) | "Overall, in both years coal and gas accounted for over half of all energy production, while the least was other energy sources." | [pie model](https://ieltsliz.com/ielts-pie-chart-task-1-model-score-9/) |
| 5 | **Table (many cells)** | Intro (rows/columns + years + units) → Overview (highest/lowest row or biggest change) → Body 1 (top group with figures) → Body 2 (bottom group with figures) | "Overall, the greatest increase in Indian students could be seen in Sheffield University, while BBP University showed the lowest increase…" | [table model](https://ieltsliz.com/ielts-table-band-9-model-answer/) |
| 6 | **Map (before/after)** | Intro (places + dates) → Overview (growth/merger + type of changes) → Body 1 (size + infrastructure) → Body 2 (housing + facilities) | "Overall, both Fonton and Meadowside village increased in size over the years until they eventually merged together…" | [map model](https://ieltsliz.com/ielts-map-model-answer/) |
| 7 | **Process / diagram** | Intro ("The diagram illustrates how…") → Overview (start → end/cyclical summary) → Body 1 (first half of stages) → Body 2 (second half + return to start) | "Overall, rainwater is collected from houses and then passes through a filter into storage where it is then treated with chemicals…" | [rainwater diagram](https://ieltsliz.com/ielts-diagram/) |
| 7b | **Mixed (two charts)** | Intro (both charts) → one Overview covering both → Body per chart | "Overall, the overwhelming majority of history graduates were employed in full-time work, while the lowest percentage of graduates entering part-time postgrad courses." | [multiple charts](https://ieltsliz.com/ielts-writing-task-1-multiple-charts/) |

Cross-pattern observations (useful as auto-grader heuristics):

- Overviews typically contain **2–4 key features** and start with "Overall,".
- Body sentences almost always pair a **movement verb** with **numbers** and **dates** ("accounted for 42% in 1980 and fell to a third in 1990").
- Models are short: 187–204 words in the samples checked; one model is explicitly annotated "**under 200 is ideal**, up to 210 acceptable".
- Model overviews for multi-year charts often include a **"least"/"only"** clause to cover the smallest category.

**Implication for app:** reuse these skeletons as report templates, and score a generated/user report by checking each skeleton slot (intro data completeness, overview coverage, body grouping, per-sentence data).

---

## 6. Task 2 — 10 instruction variants in 5 families

Sources: [types of essays](https://ieltsliz.com/types-of-ielts-essays/), [should I give my opinion](https://ieltsliz.com/ielts-writing-task-2-should-i-give-my-opinion/), [instruction equivalence](https://ieltsliz.com/ielts-essay-instructions-agree-disagree-to-what-extent/), type-specific question pages, [outweigh lesson](https://ieltsliz.com/do-the-advantages-outweigh-the-disadvantages/), [discussion model tips](https://ieltsliz.com/ielts-discussion-essay-model-answer/).

### 6.1 Family table

| Family | Variant # | Instruction wording cues | `opinion_required` | Thesis rule | Body structure |
|---|---|---|---|---|---|
| **A. Opinion (agree/disagree)** | A1 | "Do you agree or disagree?" · "Do you agree?" | **true** | Direct answer + reason preview; take one side or a **partial (balanced) view**; never "this essay will…" | BP1 side + reasons; BP2 same side, deeper OR the limited counter-side if partially agreeing |
| | A2 | "To what extent do you agree (or disagree)?" · "What is your opinion?" · "What do you think?" | **true** | Same as A1 — all these wording variants are **the same task** per Liz | Same as A1 |
| **B. Discussion** | B1 | "Discuss both sides." (no opinion asked) | **false** | No personal position needed; thesis previews both sides | BP1 side 1 (reasons why people hold it); BP2 side 2 |
| | B2 | "Discuss both sides and give your opinion." | **true** | Position in the **introduction**, not only the conclusion; discussion itself is not more important than the opinion | BP1 side 1 + your view; BP2 side 2 + your view; conclusion restates view |
| **C. Advantage / Disadvantage** | C1 | "What are the advantages and disadvantages?" · "What are the advantages … ? Are there any disadvantages?" | **false** | Thesis previews adv & disadv; do **not** pick a winner | BP1 advantages; BP2 disadvantages (keep them separate) |
| | C2 | "What are the advantages of this trend? Do the advantages outweigh the disadvantages?" (combined wording) | **true** (the second question asks for weighting) | Answer the advantages first, then commit to a weighing | BP1 advantages; BP2 disadvantages + explicit outweighing judgement |
| **D. Outweigh / Positive-Negative** | D1 | "Do the advantages outweigh the disadvantages?" · "Are there more benefits or drawbacks?" | **true** | Must choose and justify which side is stronger; "outweigh" is an **opinion** essay, not a balanced report | BP1 stronger side (with your weighting); BP2 weaker side while making the weighting explicit |
| | D2 | "Is this a positive or negative development/trend?" · "Do you think this is a good change?" · "Should people be encouraged to …?" | **true** | Choose one evaluation and explain it; position stated in intro and held throughout | BP1 chosen side + reasons; BP2 chosen side continued OR brief acknowledgement of other side |
| **E. Solution / Cause-Effect / Direct questions** | E1 | "What are the possible solutions?" · "Why is this happening and what measures can be taken?" · "What problems does it cause? What are the possible solutions?" | **false** (unless asked) | Match the number of thesis points to the number of questions; causes/problems and solutions each get a body | BP1 causes/problems; BP2 solutions (or solution-only across two bodies) |
| | E2 | Direct question sets: "Why … ? Do you think … ?" (two questions) · "What factors … ? Do we … ? Would it be better … ?" (three questions, rare) | depends — opinion **true** if a question asks "do you think/ is it good" | Answer **every** question; thesis can preview answers in order | One body paragraph per question (or combine two questions into one body if space is short) |

### 6.2 Identifying the family fast (app logic)

- Look at the **instruction sentence** (the last line of the prompt) first; the topic statement never tells you the family.
- Opinion flag = instruction contains: *agree, disagree, extent, opinion, view, think, outweigh, more benefits, positive/negative, good thing, better*.
- Discussion flag = *discuss both sides* (check whether "and give your opinion" is appended).
- Outweigh/positive-negative flag = *outweigh, more benefits or drawbacks, positive or negative, good change, should be encouraged* — always requires a position (variants C2, D1, D2).
- Solution flag = *solutions, measures, what can be done, how can this be tackled*.
- Cause/problem flag = *why, causes, reasons, problems, effect/impact*.
- Direct-question flag = multiple question marks.
- **Never** give an opinion in a task that doesn't ask for one (e.g. pure adv/disadv, pure discussion, solution-only) — it wastes relevance and can lower TR.

### 6.3 Opinion rules (all families where `opinion_required = true`)

| Rule | Detail |
|---|---|
| Must be **personal and explicit** | Use "In my opinion", "I think", "I believe"; "this essay will…" is not an opinion |
| Must not be left to the conclusion | Put it in the thesis; repeat it in bodies; restate in conclusion |
| Must stay **consistent** | You cannot change sides mid-essay |
| May be **partial/balanced** | A quantified specific view ("while some homework is useful, the amount should be limited") is allowed and often best |
| Sit-on-the-fence = fail | A balanced view is not "I agree with both sides fully" |
| Discussion + opinion | Discuss both sides **impartially**; the opinion is an add-on, not a replacement for one side |

**Implication for app:** every generated Task 2 prompt must carry `family` + `variant` + `opinion_required`; the grader then checks for an explicit position statement when `opinion_required=true` and checks for absence of forced opinion when `false`.


---

## 7. Task 2 skeletons + paragraph recipes

Sources: [essay structure & paragraphs](https://ieltsliz.com/how-many-paragraphs-for-an-ielts-essay/), [introduction lesson](https://ieltsliz.com/ielts-writing-task-2-how-to-write-an-introduction/), [thesis lesson](https://ieltsliz.com/ielts-thesis-statement-for-writing-task-2/), [paragraph word limits](https://ieltsliz.com/ielts-penalty-for-writing-under-word-count/), [conclusion page](https://ieltsliz.com/is-a-conclusion-important-in-ielts-writing-task-2/), [essay planning](https://ieltsliz.com/ielts-writing-task-2-essay-planning-tips/), [addressing the task](https://ieltsliz.com/ielts-writing-task-2-addressing-the-task/).

### 7.1 Two legal skeletons (only these)

| Skeleton | Paragraphs | When |
|---|---|---|
| **4-paragraph** | Introduction → Body 1 → Body 2 → Conclusion | default for most essays |
| **5-paragraph** | Introduction → Body 1 → Body 2 → Body 3 → Conclusion | when the task has 3 issues/questions, or 3 well-developed ideas |

Illegal: 3 paragraphs (no conclusion), 6+ paragraphs, one body paragraph, four+ body paragraphs. ([paragraph rules](https://ieltsliz.com/is-a-conclusion-important-in-ielts-writing-task-2/))

### 7.2 Paragraph word budget (270–290 total)

| Paragraph | Words | Content recipe |
|---|---|---|
| Introduction | **40–50** (Liz's intro lesson allows 45–60 as an outer bound; treat 40–50 as the target) | Statement 1 = **background statement** (paraphrase of the question). Statement 2 = **thesis statement** (direct answer / opinion / preview of main points). No hook needed; interest is not marked. |
| Body paragraph (×2) | **≈95 each** | Topic sentence (1) → explain the main idea (2–3 sentences) → support: reason / example / consequence (2–3 sentences) → mini-conclusion tying back to the question (1). Keep one central topic per paragraph; bodies must not overlap. |
| Body paragraph (×3) | **≈65 each** | Same recipe compressed; each idea must still be "extended", not just stated. |
| Conclusion | **30–40**, one or two sentences | Restate position/main points in new words. Never add a new main point; never change your opinion. Start with **In conclusion** or **To conclude**. |

Body paragraphs don't need to be exactly equal, but avoid a very long body next to a very short one. All supporting points must be 100% relevant; padding lowers TR.

### 7.3 Introduction recipe (both statement types)

| Slot | What goes in it | Do | Don't |
|---|---|---|---|
| Background | Paraphrase of the issue(s) in the question statement | change word order, use synonyms carefully, keep key terms accurate | copy the statement (copied words are not counted); over-paraphrase into error; change the meaning |
| Thesis | Your answer / position / preview of main points | be specific to the topic; use "In my opinion / I think" where an opinion is required; match the number of points to the number of questions | use memorised generics ("This essay will discuss both sides and give an opinion at the end.") |

### 7.4 Body-paragraph recipe per family

| Family | Topic sentence should announce | Supporting-point shape |
|---|---|---|
| Opinion | the side you're arguing | reason → consequence → example of the consequence |
| Discussion | which side this paragraph covers ("On the one hand, those who support X argue…") | reason why that side believes it → illustration → its implication |
| Adv/Disadv | "advantages" or "disadvantages" (never mixed) | benefit/drawback → who experiences it → result |
| Outweigh | which side you weight more strongly and why | advantage/drawback + explicit weighing language ("this matters more because…") |
| Pos/Neg development | the direction you chose | cause → effect → why that is good/bad overall |
| Solution/Cause | causes or problems, then solutions | cause/problem → mechanism → fix → who must act |
| Direct questions | the question being answered (mirror its wording in the topic sentence) | direct answer → justification → example |

### 7.5 Planning method (5 minutes, non-negotiable)

1. **Analyse** (≈1 min): circle the instruction; underline each issue; decide the family and `opinion_required`.
2. **Brainstorm** (≈1.5 min): list 3–4 main ideas per side/issue.
3. **Select** (≈0.5 min): keep only the best 2 (or 3) — more ideas ≠ higher score.
4. **Plan supports** (≈1.5 min): for each selected idea, note 2 supporting points (reason, example, consequence).
5. **Organise** (≈0.5 min): assign ideas to body paragraphs so nothing overlaps; decide the order (usually strongest first).
6. Write the plan on the **question paper** (examiner never sees it). On computer test, use the provided paper/notes area.
7. Run a 2-minute end-of-essay check: conclusion present, position consistent, no new points in conclusion, spelling of key terms.

### 7.6 Conclusion recipes

- 1 sentence: `In conclusion, [restated position], because [compressed main reason].`
- 2 sentences: sentence 1 restates the position; sentence 2 compresses the two body ideas or adds a forward-looking implication.
- Allowed openers: **In conclusion**, **To conclude**. Acceptable but weaker: **To sum up**. Banned: **In a nutshell** (informal), **Finally** (means last body point), **In general** (not a conclusion signal) — [conclusion linkers video](https://ieltsliz.com/ielts-writing-task-2-video-lesson-conclusion-linkers/).

**Implication for app:** implement the paragraph budget as a live progress meter (intro 40–50 / bodies ~95 / conclusion 30–40 → total 270–290) and a structural validator that flags: missing conclusion, one-body-paragraph essays, overlapping body topics, new ideas in the conclusion, and opinion placed only in the conclusion.

---

## 8. Task 2 ideas + vocabulary per topic

Sources: [2026 essay topics](https://ieltsliz.com/ielts-essay-topics-for-2026/), [20 common topics](https://ieltsliz.com/common-essay-topics-for-ielts/), [100 essay questions](https://ieltsliz.com/100-ielts-essay-questions/) + its topic pages, topic idea pages ([tourism](https://ieltsliz.com/tourism-and-the-local-community/), [technology](https://ieltsliz.com/technology-topic-for-writing-task-2/), [environment](https://ieltsliz.com/the-environment-topic-for-writing-task-2/)).

Legend for seed ideas: `[O]` opinion · `[D]` discussion · `[A]` adv/disadv · `[W]` outweigh · `[P]` pos/neg · `[S]` solution/cause · `[Q]` direct questions.

### 8.1 Twenty topics × 2–3 prompt seeds

| # | Topic | Prompt seed 1 | Prompt seed 2 | Prompt seed 3 |
|---|---|---|---|---|
| 1 | **Art** | Many people think museums and galleries should only show local artists rather than work from other countries. Do you agree? `[O]` | The government should spend more on the arts, while others think funding should go to health care and education. Discuss both sides and give your opinion. `[D]` | Social media is changing the way we appreciate art. Is this a positive or negative trend? `[P]` |
| 2 | **Business & Money** | It is better to work for yourself than for a company. What are the advantages and disadvantages of doing so? `[A]` | Small local businesses are being threatened by large chain stores. Why is this? What can be done about it? `[S]` | More and more business meetings are taking place online. What are the advantages and disadvantages of this trend? `[A]` |
| 3 | **Communication & Personality** | Some people think that ambition is essential for success. To what extent do you agree? `[O]` | Some people follow trends, while others set them. Why do you think this is? Do you think it is better to set trends? `[Q]` | Some people are born to be successful. Do you agree? `[O]` |
| 4 | **Crime & Punishment** | Many criminals commit further crimes after release from prison. What are the causes of this? What possible solutions can you suggest? `[S]` | Some countries struggle with rising crime. Many people think more police on the streets is the only way to reduce crime. To what extent do you agree? `[O]` | Some people think prisoners should do unpaid community work instead of being put behind bars. To what extent do you agree? `[O]` |
| 5 | **Culture & Tourism** | Over the last few decades there has been an increase in international tourism. Some people think tourism is beneficial for local communities and should be encouraged. To what extent do you agree or disagree? `[O]` | Tourism to remote areas is becoming more popular. Why is this? What impact does this have on local cultures? `[Q]` | Traditional lifestyles are slowly being forgotten. Do you think this is a bad thing? What can be done about it? `[Q]` |
| 6 | **Education** | Some people think students should only focus on the subjects they excel at. Do you agree or disagree? `[O]` | Many children think school is boring, which affects their focus and academic performance. What causes this? What solutions can you suggest? `[S]` | Education in rural areas is often not as good as in cities. Why is that? What can be done about it? `[S]` |
| 7 | **Environment** | While some people consider global warming the most pressing environmental problem, others believe deforestation has a more devastating impact. Discuss both sides and give your opinion. `[D]` | Many species are becoming extinct. Do you think this is a problem? What can be done about it? `[Q]` | Some people think environmental issues are global problems; others believe individuals must tackle them. Discuss both sides and give your opinion. `[D]` |
| 8 | **Family & Children** | Some people think grandparents have a lot to teach their grandchildren, while others think they are too out of date. Discuss both sides and give your opinion. `[D]` | In the modern world fewer families eat meals together. Why is this? Is it a positive or negative trend? `[Q]` | Some people think parents should be strict; others think children need freedom to make their own choices. Discuss both sides and give your opinion. `[D]` |
| 9 | **Food & Diet** | More and more children are eating junk food. What are the reasons for this? What can be done to solve this? `[S]` | People should only buy food sourced locally. What are the advantages and disadvantages of this? `[A]` | Traditional food is becoming less popular. Do you think this is a problem? What can be done about it? `[Q]` |
| 10 | **Government & Society** | Poor countries need financial aid from richer countries. Do you think rich countries have an obligation to support them? `[O]` | Many major cities have a problem with homelessness. How can this be solved? `[S]` | The government should focus on building new housing for a growing population rather than renovating old buildings. To what extent do you agree? `[O]` |
| 11 | **Health & Exercise** | The government should spend less on curing illnesses and more on preventing them. Do you agree? `[O]` | Many children spend most of their free time using screens. Why is this a problem? What solutions can you suggest? `[S]` | Some sports professionals earn more than doctors or nurses. Do you think this is right? `[O]` |
| 12 | **Housing & Urban Planning** | Some people think urban spaces should be used for parks rather than housing. Discuss both sides and give your opinion. `[D]` | Cities should be designed to be attractive for local people and foreign tourists. Do you agree or disagree? `[O]` | In some countries people are moving out of cities to the countryside. Why is this? Is it a positive or negative trend? `[Q]` |
| 13 | **Language** | The world will one day have only one language. To what extent do you agree? `[O]` | As computers translate quickly and accurately, learning foreign languages is a waste of time. Do you agree? `[O]` | Some schools no longer teach children to write with a pen. Do you think children should learn handwriting skills? `[O]` |
| 14 | **Media & Advertising** | Some people get their news from the internet, while others do not trust the news they read online. Discuss both sides and give your opinion. `[D]` | Adverts for products often entice people to buy things they do not need. Why is this? Is it a problem? `[Q]` | More people are becoming famous because of reality shows. Do you think this is a positive or negative trend? `[P]` |
| 15 | **Reading & Books** | What are the advantages and disadvantages of e-books compared with paper books? `[A]` | The government should stop supporting public libraries because most information is available online. Do you agree? `[O]` | Schools and parents should encourage children to read more. What is your opinion? `[O]` |
| 16 | **Space Exploration** | Some countries spend a lot of money on space exploration. What are the advantages and disadvantages of this? `[A]` | Space exploration is a waste of money and the funds should be relocated to more needed areas. To what extent do you agree? `[O]` | Do you think the benefits of space exploration outweigh the drawbacks? `[W]` |
| 17 | **Sport** | Schools should increase the number of sports and exercise classes to help children become healthy adults. What is your opinion? `[O]` | International sporting events are very popular. Why is this? `[Q]` | Some people think sport should be a compulsory school subject. Do you agree? `[O]` |
| 18 | **Technology** | Some people think teachers will one day be replaced in the classroom by technology. To what extent do you agree? `[O]` | Some images and videos online are created by AI. What are the advantages and disadvantages of this? `[A]` | Some people think the more technology develops, the fewer jobs there will be. To what extent do you agree? `[O]` |
| 19 | **Transport & Traffic** | More and more cities are struggling with air pollution. Why is this? What solutions can you suggest? `[S]` | Some countries invest more in public transport, while others invest in expanding roads. Discuss both sides and give your opinion. `[D]` | Long-distance flights are bad for the environment and should be discouraged. To what extent do you agree? `[O]` |
| 20 | **Work & Employment** | Many people around the world work very long hours. Why is this? Do you think this is a good thing? `[Q]` | Some people do work they love; others work solely for money. Discuss both sides and give your opinion. `[D]` | Working hard is the only way to be successful. Do you agree? `[O]` |

Seed-idea note: reported questions are student recollections; Liz advises preparing **ideas for topics** and then adapting them, because the same topic can return with different instructions (her art example shows agree/disagree, discussion and direct-question versions of one issue).

### 8.2 Topic collocations (Liz-sourced where available)

| Topic | Collocations / idea phrases from the site |
|---|---|
| Tourism | boosts revenue · supports the local economy · opens up employment · stimulates local entrepreneurship · fosters cross-cultural understanding · seasonal employment · economic dependency · cultural erosion · rising housing costs · middleman/tour operators |
| Technology | unsupervised internet access · relying too much on technology · breakdown in communication · appliances reduce housework · screen time · data privacy/safety of personal information |
| Environment | climate change · deforestation · habitat loss · endangered species · extinction · illegal hunting · natural beauty spots · government vs individual responsibility · green spaces · recycling |
| Health | prevention vs cure · obesity · balanced diet · mental health · healthcare funding · sedentary lifestyle · health education · source: generated |
| Education | soft skills · vocational vs academic · discipline · curriculum · gap year · class size · funding · online learning · literacy · source: generated |
| Work | remote working · work-life balance · long hours · job satisfaction · salary inequality · automation · job security · team player vs independent worker · source: generated |
| Crime | rehabilitation vs punishment · reoffending · deterrent · juvenile crime · capital punishment · community service · law enforcement · prevention · source: generated |
| Media | censorship · freedom of speech · fake news · clickbait · role models · privacy · advertising to children · source: generated |
| Transport | congestion · infrastructure · public transport · emissions · cycling schemes · road expansion · rush hour · source: generated |
| Housing/Urban | affordable housing · urban sprawl · regeneration · high-rise living · public spaces · green belts · source: generated |

For topics where the site has no dedicated idea page (e.g. Food, Family, Reading), the app should generate collocations from a general academic word list and mark them `source: "generated"`.

### 8.3 Linkers by function (Task 2)

| Function | Linkers (from Liz's list) |
|---|---|
| Listing | firstly, secondly, another point to consider, a further consideration, another issue, lastly / last but not least / finally |
| Adding | in addition, additionally, furthermore, moreover, also, not only … but also, as well as, and |
| Examples | for example, one clear example is, for instance, such as, namely, to illustrate, in other words |
| Results | as a result, consequently, therefore, thus, hence, so, for this reason |
| Highlighting | particularly, in particular, specifically, especially, obviously, of course, clearly |
| Contrast/concession | admittedly, however, nevertheless, even though, although, but, despite, in spite of, still, on the other hand, by contrast, in comparison, alternatively, another option could be |
| Reasons | because, owing to, due to, since, as |
| Opinion | in my opinion, I think, I believe, I admit, in my view, I concur / agree, I disagree / I cannot accept |
| Conclusion | **In conclusion**, **To conclude** (avoid "In a nutshell", "Finally", "In general") |

Caution: "Firstly/Secondly" for every paragraph is **mechanical** and hurts band 7+; mix linkers flexibly. Never start a formal sentence with "but" or "because" (use "Despite", "Due to", "Owing to", "Although + clause"). "Despite" needs no "of"; "regardless of" works as a preposition.

### 8.4 Uncountables that cause band losses

Core list (from [uncountable nouns](https://ieltsliz.com/uncountable-nouns-word-list/)): **accommodation, advertising, advice, aid, art, assistance, cash, chaos, clothing, corruption, courage, damage, data, education, electricity, employment, energy, entertainment, equipment, evidence, furniture, happiness, health, homework, information, intelligence, knowledge, labour, leisure, litter, luggage, money, music, news, nutrition, obesity, pollution, poverty, progress, research, rubbish, safety, software, traffic, transportation, travel, unemployment, violence, wealth, weather, welfare, wildlife, work.**

Rules: no plural *s*; no "a/an"; verb is singular ("information **is**"); quantify with partitives ("a piece of information", "an item of clothing", "a piece of equipment"); use *much / a lot of* (not *many*), *how much* (not *how many*), *this* (not *these*). Watch dual nouns: business, cheese, education, food, hair, paper, room, time, work, weight.

### 8.5 Banned / high-risk memorised phrases

From [10 sentences to avoid](https://ieltsliz.com/ielts-writing-tips-sentences-to-avoid/) and [thesis lesson](https://ieltsliz.com/ielts-thesis-statement-for-writing-task-2/):

1. "This essay will discuss both sides and give an opinion at the end." (15 memorised words, adds nothing)
2. "I shall put forth my arguments to support my views in the following paragraphs."
3. "With the development of science and modern technology…" (only valid if the topic is science/tech)
4. "In the modern era…" / "Since the dawn of time…" / "Nowadays…" as filler openers
5. "This is a highly controversial issue." / "highly debatable" (IELTS topics are rarely controversial)
6. "The crux of the discussion is…" (prefer "The most important aspect…")
7. "For example, a recent study from the IMF showed that…" / "Research indicates that…" (no citations needed)
8. "It can broaden a person's horizons."
9. "There are good grounds to argue in favour of…" / "It cannot be denied that…"
10. "In a nutshell, …" (informal conclusion opener)
11. "… the aforementioned arguments offer insights into vindications for the impression that…"
12. Idioms/quotes/proverbs generally: idioms are informal and quotes don't demonstrate your English (phrasal verbs — *look after, bring about, give rise to* — are the better "idiomatic language").

**Implication for app:** ship the topic→seed table as the prompt generator's source of truth, keep a `bannedPhrase` regex list in the grader (deduct LR/TR when a memorised thesis is detected), and attach `opinion_required` from §6 to each generated prompt.

---

## 9. Marking criteria — 4 pillars × Bands 6/7/8/9

Sources: [T1 band scores](https://ieltsliz.com/ielts-writing-task-1-band-scores/), [T2 band scores](https://ieltsliz.com/ielts-writing-task-2-band-scores-5-to-8/), [band descriptors page](https://ieltsliz.com/ielts-writing-task-2-band-descriptors/), [writing scoring](https://ieltsliz.com/ielts-writing-scoring/). Tables below are **paraphrased** from the public IELTS descriptors that Liz cites; add the official descriptor PDF link from her page before shipping any user-facing rubric.

### 9.1 Task Achievement (T1) — checkable

| Check | Band 6 | Band 7 | Band 8 | Band 9 |
|---|---|---|---|---|
| Task coverage | Addresses requirements; format may be off | Covers requirements | Covers all requirements sufficiently | Fully satisfies all requirements |
| Overview | **Attempted** but not well done | **Clear** overview of main trends/differences/stages | Clear overview; key features **skilfully selected** | Overview and selection fully developed and skilful |
| Key features | Describes some but detail may be irrelevant/inaccurate | Clearly presents and highlights key features | Well-presented, well-developed; could extend further | Fully extended, fully supported |
| Data | Some data included | Relevant data included | Relevant data/figures well presented | Precise, fully supported |
| Response shape | May lack focus | Focused | Focused, well developed | Fully developed |

### 9.2 Task Response (T2) — checkable

| Check | Band 6 | Band 7 | Band 8 | Band 9 |
|---|---|---|---|---|
| All parts answered | All parts, some more fully than others | Addresses all parts | Sufficiently addresses all parts | Fully explores all parts |
| Position | Relevant but conclusions may be unclear/repetitive | **Clear position throughout** | Clear, well-developed position | Fully developed position |
| Ideas | Some main ideas inadequately developed | Main ideas extended/supported (may over-generalise) | Ideas extended and supported; a few could be fuller | Ideas **fully extended** and supported |
| Focus | May have irrelevant detail | Some supporting ideas may lack focus | Occasional over-generalisation/lack of focus | Fully focused |

### 9.3 Coherence & Cohesion — checkable

| Check | Band 6 | Band 7 | Band 8 | Band 9 |
|---|---|---|---|---|
| Overall progression | Coherent overall but progression may be unclear | **Clear progression** throughout | Logically sequenced | Sequencing skilfully managed |
| Paragraphing | May be inadequate / not always logical | Clear central topic in each paragraph | Paragraphing sufficient and appropriate | Paragraphing skilfully managed |
| Cohesive devices | Faulty/mechanical, over/under-used | Range used appropriately (some over/under-use) | Manages all aspects well | Cohesion attracts **no attention** |
| Referencing | May be repetitive/ineffective | Generally effective | Effective | Fully effective |

### 9.4 Lexical Resource — checkable

| Check | Band 6 | Band 7 | Band 8 | Band 9 |
|---|---|---|---|---|
| Range | Adequate; repetitive at times | Enough for flexibility and precision | Wide; some uncommon items | Wide with full flexibility |
| Less common / idiomatic | Attempts with inaccuracy | Some less common/idiomatic vocabulary | Skilful use, occasional inaccuracy | Precise, appropriate |
| Collocation | Noticeable errors | Awareness; some inappropriate choices | Occasional collocation slips | Virtually error-free |
| Spelling/word formation | Errors that may cause some difficulty | **Few** errors | Occasional errors | Very occasional slips |

### 9.5 Grammatical Range & Accuracy — checkable

| Check | Band 6 | Band 7 | Band 8 | Band 9 |
|---|---|---|---|---|
| Structures | Mix of simple and complex | **Variety of complex structures** | Wide range | Wide range with full flexibility |
| Error-free sentences | Some | **Frequent** error-free sentences | **Majority** error-free | All, bar rare slips |
| Control/punctuation | Some errors, rarely impede | Good control, a few errors | Occasional errors/inappropriacies | Full control |
| Communication impact | Rarely reduces clarity | Does not reduce clarity | Does not reduce clarity | — |

### 9.6 Weighting, rounding and score caps

| Rule | Detail | Source |
|---|---|---|
| Criterion weights | Each of the 4 criteria = **25%** of the task score | [scoring](https://ieltsliz.com/ielts-writing-scoring/) |
| T1 worked example | 7 + 8 + 6 + 7 = 28 ÷ 4 = **7.0** | [T1 bands](https://ieltsliz.com/ielts-writing-task-1-band-scores/) |
| T2 worked example | 6 + 7 + 6 + 6 = 25 ÷ 4 = 6.25 → **6.5** (round up to next half band) | [T2 bands](https://ieltsliz.com/ielts-writing-task-2-band-scores-5-to-8/) |
| Overall writing score | T2 counts **twice** T1 (T2 ≈ 66%, T1 ≈ 33%); T1 8 + T2 6 → **6.5**; estimates accurate within 0.5 | [scoring](https://ieltsliz.com/ielts-writing-scoring/) |
| No conclusion (T2) | **Below band 6 in Task Response** | [conclusion](https://ieltsliz.com/is-a-conclusion-important-in-ielts-writing-task-2/) |
| No overview (T1) | **Band 5 or below in Task Achievement** (5 = no clear overview; 6 = overview attempted; 7 = clear overview) | [overview](https://ieltsliz.com/is-the-overview-important-in-ielts-wt1-answers/), [structure](https://ieltsliz.com/writing-task-1-report-structure/) |
| One body paragraph (T2) | ≈ **band 5 CC** | [paragraphs](https://ieltsliz.com/how-many-paragraphs-for-an-ielts-essay/) |
| Memorised answer | May not be accepted; **possible band 0** | [penalty](https://ieltsliz.com/ielts-penalty-for-writing-under-word-count/) |
| Half-answered question | Cannot exceed **band 5 TR** | [penalty](https://ieltsliz.com/ielts-penalty-for-writing-under-word-count/) |
| Fewer than 4 paragraphs / 6+ paragraphs | CC and TR penalty (paragraphing rules) | [paragraphs](https://ieltsliz.com/how-many-paragraphs-for-an-ielts-essay/) |
| Band 9 vs 8 difference | "density of errors" is the main differentiator | [T2 bands](https://ieltsliz.com/ielts-writing-task-2-band-scores-5-to-8/) |

**Implication for app:** implement per-criterion scores 5–9 in 0.5 steps, compute task score = mean, round up to nearest 0.5, then overall = (T1 + 2×T2)/3 rounded to 0.5; apply the caps as hard overrides after averaging (a no-conclusion essay cannot show TR>5 even if other criteria are 8).

---

## 10. Grading-feedback design

Goal: for each of the 4 criteria, produce (a) a band estimate, (b) a rubric check list, (c) 2–4 feedback starters, each anchored to an exact `evidenceSpan` in the user's text. All wording below is derived from §9 descriptors and Liz's tips.

### 10.1 Feedback starters per criterion

| Criterion | Band-6-ish starter | Band-7-ish starter | Band-8+-ish starter |
|---|---|---|---|
| **TA (T1)** | "Your overview is attempted but key features are incomplete — {evidenceSpan} misses the [highest/lowest/biggest change]." | "Your overview is clear; extend it by adding {evidenceSpan} to cover the remaining key feature." | "Key features are skilfully selected and supported; tighten {evidenceSpan} so every figure is precisely attributed." |
| **TR (T2)** | "Parts of the task are under-answered — {evidenceSpan} covers only one of the two questions." | "Your position is clear throughout; strengthen {evidenceSpan} by extending the supporting reason with a consequence." | "Your response is well developed; keep the weighting explicit in {evidenceSpan} so the outweigh judgement is unambiguous." |
| **CC** | "Paragraphing needs work — {evidenceSpan} mixes two main ideas; split them." | "Clear progression overall; replace the mechanical linker in {evidenceSpan} with a content-based contrast." | "Organisation is strong; ensure referencing in {evidenceSpan} (this/it/these) points unambiguously to its noun." |
| **LR** | "Adequate range but repetition — {evidenceSpan} repeats '{term}'; use a precise synonym from the language bank." | "Good flexibility; fix the collocation error in {evidenceSpan} ('{wrong}' → '{right}')." | "Precise vocabulary; check spelling/word-form in {evidenceSpan} and the article in {evidenceSpan}." |
| **GRA** | "Mix of simple and complex structures; there are tense errors in {evidenceSpan} for a [past/future] chart." | "Variety of complex structures with frequent error-free sentences; correct the punctuation in {evidenceSpan}." | "Wide range with accurate control; the only issue is {evidenceSpan}, where a minor article/slip occurs." |

### 10.2 Evidence-span schema for feedback objects

| Field | Purpose |
|---|---|
| `criterion` | TA / TR / CC / LR / GRA |
| `band` | estimated band for the criterion (5–9, step .5) |
| `checkId` | which rubric row fired (e.g. `t1.overview.coverage`) |
| `evidenceSpan` | `{startChar, endChar, text}` pointing into the submitted text |
| `severity` | `cap` (score cap), `error` (accuracy), `upgrade` (range/development) |
| `feedbackStarter` | the sentence template above with the span interpolated |
| `fixSuggestion` | concrete rewrite hint tied to the language bank (§4) |

### 10.3 Deterministic checks the grader should run before any LLM judgement

| Check | Cap triggered if failed |
|---|---|
| Word count ≥ 150 / 250 (IELTS counting rules) | no fixed penalty, but flag "short → underdeveloped" and cap TR/TA at 5 |
| Overview paragraph exists and contains ≥2 key features (T1) | TA ≤ 5 |
| Conclusion paragraph exists and is ≥1 sentence (T2) | TR ≤ 5 |
| Paragraph count = 4 or 5 (T2), body paragraphs = 2–3 | CC ≤ 5 |
| Position statement present when `opinion_required=true` and consistent at intro/body/conclusion | TR ≤ 5 if absent; TR ≤ 6 if only in conclusion |
| No memorised/generic thesis detected (banned list §8.5) | TR/LR penalty; flag academic-integrity risk |
| Data in body sentences (T1): ≥1 number or date per body sentence | TA ≤ 5 |
| Tense matches task dates (T1) | GRA penalty band cap |
| Letter-count / copied-from-question text excluded from word count | recompute count |

**Implication for app:** separate deterministic caps from subjective band judgements; always return the check list with spans so users see exactly which sentence cost them marks, mirroring Liz's "understand the requirements for the band you want" method.

---

## 11. Prompt / graph generation schemas

Design principles from the site: T1 tasks must be reportable (selectable key features, clear units, grouped categories); T2 prompts must specify topic + issues + instruction so the family and `opinion_required` are unambiguous ([quiz: understand the instructions](https://ieltsliz.com/ielts-writing-task-2-instructions/)).

### 11.1 Task 1 chart-spec

```json
{
  "specId": "t1-bar-2026-001",
  "type": "bar",
  "typeEnum": ["line", "bar", "pie", "table", "map", "process", "mixed"],
  "mixedWith": null,
  "topic": "household expenditure",
  "statement": "The chart below shows the average monthly expenditure by British households in three years.",
  "timeFrame": { "kind": "multiple-years", "values": [1990, 2000, 2010], "tenseRule": "past" },
  "axes": {
    "x": { "label": "year", "values": [1990, 2000, 2010] },
    "y": { "label": "pounds sterling per month", "unit": "£", "scale": "linear" }
  },
  "categories": ["utility bills", "transport", "rent", "entertainment", "groceries"],
  "series": [
    { "name": "rent", "values": [450, 480, 600], "trend": "up" },
    { "name": "transport", "values": [160, 200, 250], "trend": "up" },
    { "name": "utility bills", "values": [60, 100, 150], "trend": "up" },
    { "name": "groceries", "values": [305, 300, 305], "trend": "stable" },
    { "name": "entertainment", "values": [110, 105, 100], "trend": "down" }
  ],
  "keyFeatures": [
    { "id": "highest", "description": "rent is the largest expenditure in all three years" },
    { "id": "lowest", "description": "utility bills and entertainment are the lowest" },
    { "id": "biggestChange", "description": "rent rose from ~£450 to ~£600" },
    { "id": "stability", "description": "groceries barely changed" }
  ],
  "groupingStrategy": "highest-and-lowest in body 1; remaining categories by direction in body 2",
  "unitsNote": "Units are measured in pounds sterling.",
  "wordTarget": { "min": 150, "recommended": [170, 190], "hardCeiling": 210 },
  "recommendedMinutes": 20,
  "modelPatternRef": "t1.bar.2group",
  "chartImagePolicy": "render-in-app; do not hotlink source images",
  "sourceConvention": "recreate reported tasks; label charts as app-generated, not official IELTS"
}
```

`typeEnum` enumerates the allowed `type` values; `mixedWith` stays `null` for single-chart tasks and names the second chart type (e.g. `"pie"`) when `type` is `"mixed"`.

Other `type` values change `axes`/`series` shape:
- `pie`: `slices: [{label, percent}]` per year + `whole = 100`.
- `table`: `rows`, `columns`, `cells`, plus `rowTotals`/`changeColumn` flags.
- `map`: `areas: [{name, polygon|zone}]`, `features`, `changes: [{feature, from, to, year}]`, `beforeYear`, `afterYear`.
- `process`: `stages: [{order, name, input, output, equipment}]`, `isCycle: true|false`.
- `mixed`: `subCharts: [chartSpec, chartSpec]` with a shared `statement` and one combined `keyFeatures` list.

### 11.2 Task 2 prompt-spec

```json
{
  "promptId": "t2-outweigh-2026-014",
  "topic": "space exploration",
  "family": "outweigh-posneg",
  "familyEnum": ["opinion", "discussion", "adv-disadv", "outweigh-posneg", "solution-cause-effect-direct"],
  "variant": "D1",
  "opinionRequired": true,
  "statement": "Some countries spend a lot of money on space exploration.",
  "instruction": "Do the advantages of this spending outweigh the disadvantages?",
  "questionCount": 1,
  "thesisRule": "state clearly whether advantages or disadvantages dominate, and why",
  "structure": ["introduction", "body:dominant side + weighting", "body:weaker side with explicit weighing", "conclusion"],
  "seedIdeas": {
    "pro": ["scientific discovery and spin-off technology", "inspires STEM education", "long-term economic returns"],
    "con": ["opportunity cost vs healthcare/poverty", "high cost overruns", "benefits are slow and indirect"]
  },
  "bannedPhrases": ["this essay will discuss", "since the dawn of time", "in a nutshell"],
  "wordTarget": { "min": 250, "recommended": [270, 290], "hardCeiling": 300 },
  "recommendedMinutes": 40,
  "rubricRef": "t2.tr.rubric",
  "markingNotes": "Band 7 needs a clear position throughout and extended main ideas; band 6 position may be unclear/repetitive"
}
```

`familyEnum` enumerates the five Task 2 families from §6; `family` must be one of these values.

### 11.3 Session / submission payload (computer-test simulation)

```json
{
  "session": {
    "mode": "computer",
    "modeEnum": ["computer", "paper"],
    "totalMinutes": 60,
    "tasks": [
      { "task": 1, "minutesRecommended": 20, "wordMinimum": 150, "wordTarget": [170, 190] },
      { "task": 2, "minutesRecommended": 40, "wordMinimum": 250, "wordTarget": [270, 290] }
    ],
    "uiRules": {
      "plainTextBox": true,
      "spellcheck": false,
      "autocorrect": false,
      "autocapitalise": false,
      "liveWordCount": true,
      "timerVisible": true,
      "secondsHiddenLastMinute": true,
      "hardStopAtZero": true,
      "planningNotesArea": true,
      "allowCopyPaste": true,
      "allowHighlight": true
    }
  },
  "submission": {
    "task1": { "text": "...", "startedAt": "...", "submittedAt": "...", "words": 0 },
    "task2": { "text": "...", "startedAt": "...", "submittedAt": "...", "words": 0 }
  }
}
```

`modeEnum` lists the allowed session modes; `mode` must be one of them (computer-test simulation vs paper practice).

**Implication for app:** keep the chart-spec, prompt-spec and session payload as three separate JSON contracts; the auto-grader consumes chart-spec/prompt-spec (for expected key features / `opinionRequired`) plus the submission.

---

## 12. Mistakes & FAQ

### 12.1 Task 1 — 30 mistakes to detect

| # | Mistake | Fix / rule | Source |
|---|---|---|---|
| 1 | Copying the question statement into the intro | paraphrase; copied words are not counted | [intro errors](https://ieltsliz.com/ielts-writing-task-1-introduction/) |
| 2 | Wrong chart noun ("diagram" for a line graph, "graph" for a bar chart) | keep the chart's own name | [intro errors](https://ieltsliz.com/ielts-writing-task-1-introduction/) |
| 3 | Using "amount" for countable nouns | "number of students", "amount of money" | [improving intro](https://ieltsliz.com/improving-ielts-writing-task-1-introduction/) |
| 4 | Missing/incomplete dates, categories or countries in the intro | give precise years, list categories or say how many | [intro errors](https://ieltsliz.com/ielts-writing-task-1-introduction/) |
| 5 | Over-paraphrasing until the meaning changes | minimal paraphrase + sentence restructuring | [chart practice](https://ieltsliz.com/ielts-chart-practice-for-writing-task-1/) |
| 6 | Paraphrasing words that must not change (town → city, road → street, Britain → England) | key terms stay | [map vocab](https://ieltsliz.com/ielts-maps-vocabulary/) |
| 7 | No overview | overview is compulsory; TA ≤ 5 without one | [overview](https://ieltsliz.com/is-the-overview-important-in-ielts-wt1-answers/) |
| 8 | Overview attempted but vague | band 6 = attempted, band 7 = clear | [structure](https://ieltsliz.com/writing-task-1-report-structure/) |
| 9 | Key features spread across body paragraphs | collect all key features in one overview | [overview](https://ieltsliz.com/is-the-overview-important-in-ielts-wt1-answers/) |
| 10 | Only one key feature | include highs/lows/biggest change/stability | [overview](https://ieltsliz.com/is-the-overview-important-in-ielts-wt1-answers/) |
| 11 | Writing a conclusion | T1 needs an overview, not a conclusion | [conclusion/overview](https://ieltsliz.com/ielts-tips-conclusion-or-overview-for-writing-task-1/) |
| 12 | One body paragraph / 4+ body paragraphs | 2 bodies (3rd rare) | [organisation answers](https://ieltsliz.com/answers-to-organising-bar-chart-paragraphs/) |
| 13 | Illogical grouping of categories | group by pattern or magnitude, not random | [organisation answers](https://ieltsliz.com/answers-to-organising-bar-chart-paragraphs/) |
| 14 | Body sentences without data | every body sentence should carry numbers/dates | [bar chart tips](https://ieltsliz.com/ielts-bar-chart-tips-and-techniques-for-a-high-score/) |
| 15 | Inventing precise figures from a visual estimate | use "just under 30%", not "28%" | [accurate data](https://ieltsliz.com/vocabulary-for-accurate-data/) |
| 16 | Wrong tense for dated data | past/future/present per date rule; both for spans | [tenses](https://ieltsliz.com/what-tense-to-use-in-ielts-writing-task-1/) |
| 17 | Forcing passive voice into a chart task | passive only where appropriate (process/map) | [tenses](https://ieltsliz.com/what-tense-to-use-in-ielts-writing-task-1/) |
| 18 | Inaccurate country/nationality articles | the UK/US; Britain/England without "the" | [tenses](https://ieltsliz.com/what-tense-to-use-in-ielts-writing-task-1/) |
| 19 | Wrong sport collocations | "do cycling", "take part in", not "play cycling" / "engage in" / "compete in" | [synonyms answers](https://ieltsliz.com/answers-to-ielts-writing-task-1-synonyms-exercise/) |
| 20 | Subject–verb agreement ("The pie charts shows") | plural charts → show | [grammar](https://ieltsliz.com/grammar-ielts-writing-task-1/) |
| 21 | Missing articles ("There was significant decrease") | "a significant decrease" | [grammar](https://ieltsliz.com/grammar-ielts-writing-task-1/) |
| 22 | Plural errors ("all area", "other item") | areas, items | [grammar](https://ieltsliz.com/grammar-ielts-writing-task-1/) |
| 23 | Preposition errors (increase *in* / difference *of* / "except with housing") | learn the dependent prepositions | [grammar](https://ieltsliz.com/grammar-ielts-writing-task-1/) |
| 24 | Punctuation slips (missing comma before "while") | commas with contrast clauses | [grammar](https://ieltsliz.com/grammar-ielts-writing-task-1/) |
| 25 | Over-writing (>200–210 words) or getting lost in detail | be concise; select features | [preparation tips](https://ieltsliz.com/ielts-writing-task-1-preparation-tips/), [multiple charts](https://ieltsliz.com/ielts-writing-task-1-multiple-charts/) |
| 26 | Under-writing (<150) | target 170–190 | [preparation tips](https://ieltsliz.com/ielts-writing-task-1-preparation-tips/) |
| 27 | Comparing everything | compare "where relevant"; too much comparison confuses | [Task 1 FAQ](https://ieltsliz.com/ielts-writing-task-1-faq/) |
| 28 | Including opinions | T1 is a factual report; opinion loses TA marks | [T1 bands](https://ieltsliz.com/ielts-writing-task-1-band-scores/) |
| 29 | Map grammar ("is locate", "was constructing", "is building") | passive: is located, was constructed, was built | [map comparison](https://ieltsliz.com/ielts-map-comparison/) |
| 30 | Mixed-task errors: two overviews, or dropping a whole category | one combined overview; select but don't omit categories | [multiple charts](https://ieltsliz.com/ielts-writing-task-1-multiple-charts/) |

### 12.2 Task 2 — biggest mistakes (Liz's list + rules)

| # | Mistake | Consequence | Source |
|---|---|---|---|
| 1 | Not analysing the precise meaning/wording of the question | off-topic body paragraphs | [addressing the task](https://ieltsliz.com/ielts-writing-task-2-addressing-the-task/) |
| 2 | Not addressing the specific key issue(s) — writing about the general topic | TR ≤ 5 if half the question unanswered | [addressing the task](https://ieltsliz.com/ielts-writing-task-2-addressing-the-task/) |
| 3 | No clear opinion when one is asked; using "this essay will…" | TR cap | [opinion rules](https://ieltsliz.com/ielts-writing-task-2-should-i-give-my-opinion/) · [sentences to avoid](https://ieltsliz.com/ielts-writing-tips-sentences-to-avoid/) |
| 4 | Opinion only in the conclusion | weak position; band 6-ish TR | [opinion rules](https://ieltsliz.com/ielts-writing-task-2-should-i-give-my-opinion/) · [thesis statement](https://ieltsliz.com/ielts-thesis-statement-for-writing-task-2/) |
| 5 | Changing opinion mid-essay | incoherent position | [opinion rules](https://ieltsliz.com/ielts-writing-task-2-should-i-give-my-opinion/) |
| 6 | Siding with one issue but ignoring the other in opinion essays | low TR | [opinion rules](https://ieltsliz.com/ielts-writing-task-2-should-i-give-my-opinion/) · [addressing the task](https://ieltsliz.com/ielts-writing-task-2-addressing-the-task/) |
| 7 | Turning an opinion essay into a discussion (or vice versa) | irrelevant content | [opinion rules](https://ieltsliz.com/ielts-writing-task-2-should-i-give-my-opinion/) · [addressing the task](https://ieltsliz.com/ielts-writing-task-2-addressing-the-task/) |
| 8 | Giving an opinion when the task doesn't ask | wasted relevance | [opinion rules](https://ieltsliz.com/ielts-writing-task-2-should-i-give-my-opinion/) |
| 9 | No planning of main **and** supporting points | undeveloped ideas | [thesis statement](https://ieltsliz.com/ielts-thesis-statement-for-writing-task-2/) · [paragraphs](https://ieltsliz.com/how-many-paragraphs-for-an-ielts-essay/) |
| 10 | Too many ideas, none developed | band 5-ish "limited, not sufficiently developed" | [paragraphs](https://ieltsliz.com/how-many-paragraphs-for-an-ielts-essay/) |
| 11 | Irrelevant/unfocused detail ("padding") | lower TR/LR | [addressing the task](https://ieltsliz.com/ielts-writing-task-2-addressing-the-task/) · [paragraphs](https://ieltsliz.com/how-many-paragraphs-for-an-ielts-essay/) |
| 12 | Very unequal body paragraph lengths | CC/TR pressure | [paragraphs](https://ieltsliz.com/how-many-paragraphs-for-an-ielts-essay/) |
| 13 | One body paragraph | CC ≈ 5 | [paragraphs](https://ieltsliz.com/how-many-paragraphs-for-an-ielts-essay/) |
| 14 | 6+ paragraphs / no clear paragraph topics | CC penalty | [paragraphs](https://ieltsliz.com/how-many-paragraphs-for-an-ielts-essay/) · [conclusion](https://ieltsliz.com/is-a-conclusion-important-in-ielts-writing-task-2/) |
| 15 | No conclusion | TR < 6 | [conclusion](https://ieltsliz.com/is-a-conclusion-important-in-ielts-writing-task-2/) |
| 16 | New main point in the conclusion | TR/CC penalty | [conclusion](https://ieltsliz.com/is-a-conclusion-important-in-ielts-writing-task-2/) · [paragraphs](https://ieltsliz.com/how-many-paragraphs-for-an-ielts-essay/) |
| 17 | Wrong conclusion linker ("In a nutshell", "Finally", "In general") | LR/CC penalty | [conclusion](https://ieltsliz.com/is-a-conclusion-important-in-ielts-writing-task-2/) · [sentences to avoid](https://ieltsliz.com/ielts-writing-tips-sentences-to-avoid/) |
| 18 | Memorised sentences and fillers | examiner spots them; TR/LR penalty | [sentences to avoid](https://ieltsliz.com/ielts-writing-tips-sentences-to-avoid/) · [thesis statement](https://ieltsliz.com/ielts-thesis-statement-for-writing-task-2/) |
| 19 | Copying the question wording | copied words not counted; risk of under-length | [thesis statement](https://ieltsliz.com/ielts-thesis-statement-for-writing-task-2/) · [addressing the task](https://ieltsliz.com/ielts-writing-task-2-addressing-the-task/) |
| 20 | Under 250 words | underdeveloped ideas (fixed penalty removed) | [paragraphs](https://ieltsliz.com/how-many-paragraphs-for-an-ielts-essay/) |
| 21 | Writing far over 300 words | unfocused, more errors | [paragraphs](https://ieltsliz.com/how-many-paragraphs-for-an-ielts-essay/) · [conclusion](https://ieltsliz.com/is-a-conclusion-important-in-ielts-writing-task-2/) |
| 22 | Informal language, idioms, quotes, proverbs | LR penalty | [sentences to avoid](https://ieltsliz.com/ielts-writing-tips-sentences-to-avoid/) |
| 23 | Mechanical "Firstly/Secondly" paragraphing | CC band 7+ risk | [paragraphs](https://ieltsliz.com/how-many-paragraphs-for-an-ielts-essay/) |
| 24 | Grammar errors on articles, plurals, uncountables, word order | GRA/LR penalties | [sentences to avoid](https://ieltsliz.com/ielts-writing-tips-sentences-to-avoid/) |
| 25 | Spelling errors | LR penalty | [sentences to avoid](https://ieltsliz.com/ielts-writing-tips-sentences-to-avoid/) |
| 26 | Using `;` and `:` unnecessarily | punctuation risk (use commas/full stops) | [sentences to avoid](https://ieltsliz.com/ielts-writing-tips-sentences-to-avoid/) |
| 27 | Writing the title on the answer sheet | not needed, wastes a line | [sentences to avoid](https://ieltsliz.com/ielts-writing-tips-sentences-to-avoid/) |
| 28 | Illegible handwriting (paper) | score "seriously affected" | [paragraphs](https://ieltsliz.com/how-many-paragraphs-for-an-ielts-essay/) |
| 29 | Not answering **every** question in a multi-question prompt | TR cap | [addressing the task](https://ieltsliz.com/ielts-writing-task-2-addressing-the-task/) |
| 30 | "Discussion" essays that only discuss one side | TR failure | [addressing the task](https://ieltsliz.com/ielts-writing-task-2-addressing-the-task/) · [opinion rules](https://ieltsliz.com/ielts-writing-task-2-should-i-give-my-opinion/) |

### 12.3 Computer-delivered IELTS — FAQ and simulation notes

| Question | Answer (Liz) |
|---|---|
| Is CBT a different test? | No — same test, same marking, same answer keys; only delivery differs. |
| Marking difference? | None: "100% the same". |
| Only real difference | Listening: paper test allows 10 min to transfer answers; CBT gives **2 min** to check answers. Reading/Writing/Speaking timing identical. |
| Word count | Computer shows the word count automatically (you don't count); paper test requires line estimation. |
| Spelling/grammar check | **The computer will not check your spelling or grammar** — spelling is part of the marking, so proofread manually. |
| Timer | A timer is on screen; screens lock at the exact second; the timer stops showing seconds in the final minute, so the exact lock time is unknown. |
| Editing | Cut/copy/paste, move paragraphs/sentences; highlight text; make notes (note-taking for reading). |
| Planning | Pen and paper are provided for planning; planning on screen is possible too. |
| Typing | Typing speed must be adequate; typos are common — practise proofreading in a word processor. |
| Environment | Many people typing for an hour — noisy; less crowded than paper. |
| Results | Faster (approx. 3–5 days); more test slots; at-home option available (speaking still face-to-face or video call). |
| Practice advice | Use only authentic computer samples from IELTS/BC/IDP; don't use third-party computer tests because answer keys may not match. |
| Pen/pencil on paper test | Either is allowed; extra paper on request; use the official answer sheet to estimate words per line. |

Source: [computer-delivered IELTS pros & cons](https://ieltsliz.com/computer-delivered-ielts-pros-cons/) — all rows above; the quoted phrase "100% the same" is Liz's wording on that page.

**Implication for app:** the CBT sim must disable spellcheck/autocorrect/autocapitalise, show a word count and a timer that hides seconds in the last minute and hard-stops, provide a planning notes area, and never auto-correct anything — matching the real product behaviour Liz documents.

---

## 13. Gaps, contradictions, outdated notes and link-rot

### 13.1 Internal contradictions / ambiguities found on the site

| Item | Contradiction | Recommended app resolution |
|---|---|---|
| Under-word-count penalty | [T2 FAQ](https://ieltsliz.com/ielts-writing-task-2-faq/) says "You will receive a penalty from IELTS if you are under the word count", while the dedicated [penalty page](https://ieltsliz.com/ielts-penalty-for-writing-under-word-count/) states the fixed band-5 penalty **has been removed** (updated policy). | Treat FAQ line as outdated: no fixed penalty, but cap TR/TA when underdeveloped. |
| Task 1 paragraph count | [T1 band scores page](https://ieltsliz.com/ielts-writing-task-1-band-scores/) says "have four body paragraphs", while [structure](https://ieltsliz.com/writing-task-1-report-structure/) and [answers](https://ieltsliz.com/answers-to-organising-bar-chart-paragraphs/) say 2 bodies (3rd occasional) and list 4 paragraphs **total**. | Use the structure page: Intro + Overview + 2 bodies (+optional 3rd). |
| Task 1 type count | Hub says "six types" plus combination; [sample charts](https://ieltsliz.com/ielts-sample-chart-for-writing-task-1/) lists 7 including "combination"; FAQ says "many types". | Model 7 types (line, bar, pie, table, map, process, mixed). |
| Task 2 intro length | [Intro lesson](https://ieltsliz.com/ielts-writing-task-2-how-to-write-an-introduction/) says most introductions are 45–60 words; [thesis lesson](https://ieltsliz.com/ielts-thesis-statement-for-writing-task-2/) and [penalty page](https://ieltsliz.com/ielts-penalty-for-writing-under-word-count/) say 40–50. | Target 40–50; accept up to 60 without penalty. |
| Task 1 ceiling | [preparation tips](https://ieltsliz.com/ielts-writing-task-1-preparation-tips/) says "Over 210 will lower your score"; [word-count page](https://ieltsliz.com/how-many-words-ielts-writing/) allows "max 210 for complicated charts". | Warn at 200, hard-warn at 210+ (multi-chart tolerance). |
| Essay length | [paragraph page](https://ieltsliz.com/how-many-paragraphs-for-an-ielts-essay/) says 270–290 and not more than ~300; the [discussion model](https://ieltsliz.com/ielts-discussion-essay-model-answer/) is "over 300 words" with a note that 300+ is possible if highly relevant. | Keep 270–290 as target; flag 300+ as "risk, not error". |
| Opinion in discussion | "Discuss both sides" pages say don't give an opinion, but B2 variants add "and give your opinion". | Prompt-spec must carry the exact instruction; grader keys off `opinionRequired`. |
| Task 1 "overview" for diagrams | Some lessons phrase overviews for cycles as "key stages" rather than trends. | Overview checker should accept stage summaries for process/map types. |
| Hub typo | Task 1 hub contains "All writing task 2 reports have an overview" inside the Task 1 section (should read task 1). | Site bug only; no model change. |

### 13.2 Gaps (things the app must source elsewhere or generate)

- **No official Task 1 chart bank**: charts are images, often third-party (Cambridge books, unknown sources). The app must generate/redraw its own charts and label them as app-generated.
- **Band-descriptor grids are images on Liz's pages**: fine-grained band wording (esp. bands 5 and 9) had to be paraphrased from the public descriptors; verify against the current official PDFs before user-facing use (the British Council PDF links on Liz's pages now return HTTP 403 to automated requests).
- **Topic collocation lists** exist for only a few topics (tourism, technology, environment); the rest need generation and a `source: generated` flag.
- **Speaking/Listening/Reading** pages are out of scope but share vocabulary lists (e.g. linking words) that were excluded here.
- **No rubric weights for "idea quality"**: Liz repeatedly says ideas must be relevant and extended, but originality is not marked; the app should not reward originality, only development/relevance.
- **Reported-question accuracy**: the site states questions are recreated from student reports; wording may differ from real exams.

### 13.3 Link-rot observed (2026-09-21)

Link problems found in crawled pages (404/400/redirect/malformed):

| Dead URL (as linked) | Linked from | Note |
|---|---|---|
| `/recent-ielts-questions-and-topics/` | multiple lesson pages | no replacement found |
| `/rules-for-posting-writing/` | comment pages | — |
| `/ielts-writing-task-2-lessons-tips-and-information/` | older posts | use `/ielts-writing-task-2/` |
| `/table-with-three-pie-charts-model/` | [sample charts](https://ieltsliz.com/ielts-sample-chart-for-writing-task-1/) | correct page is [/ielts-table-three-pie-charts-model/](https://ieltsliz.com/ielts-table-three-pie-charts-model/) |
| `/ielts-writing-task-1-diagram-structure/` | hub/linked lessons | no replacement found |
| `/ask-a-question-2/` | [Task 1 FAQ](https://ieltsliz.com/ielts-writing-task-1-faq/) | question form removed |
| `/writing-task-1-conclusion-or-overview/` | old posts | use [/ielts-tips-conclusion-or-overview-for-writing-task-1/](https://ieltsliz.com/ielts-tips-conclusion-or-overview-for-writing-task-1/) |
| `/ielts-writing-task-2-conclusion-linkers/` | [conclusion lesson](https://ieltsliz.com/ielts-conclusion-opinion-essay/) | use [/ielts-writing-task-2-video-lesson-conclusion-linkers/](https://ieltsliz.com/ielts-writing-task-2-video-lesson-conclusion-linkers/) |
| `/answers-to-linking-words-practice-2020/` | linking practice pages | answers may be inline |
| `/ielts-writing-task-1-sample-answer-feb-2015/` | older references | — |
| `/january-2017-ielts-speaking-topics/` | topic pages | out of scope |
| `/wp-content/uploads/2099/10/IELTS-Writing-Task-1-Table.docx/` | a lesson page | broken future-dated media path (typo `2099`) |
| `http://www.ieltsliz.com/100-ielts-essay=questions/crime-and-punishment` | [100 essay questions hub](https://ieltsliz.com/100-ielts-essay-questions/) | **malformed typo ( `=` instead of `-` ) in the crime link**; currently redirects to the correct page, but should be treated as broken in any link-checker |

Outdated/archived content notes:

- Several lessons contain "old but still relevant" videos; at least one video was **removed** ("this video has been removed in order to remake it" on [complex sentence](https://ieltsliz.com/ielts-writing-task-1-complex-sentence/)).
- The site runs a content-protection script (copy/print blocking) and states "Content is protected"; research use only.
- Copyright footer: © Elizabeth Ferguson 2014–2026; latest archive entries September 2026; the 2026 topic list is the most current question bank.

**Implication for app:** build a content-health job that periodically re-checks all cited URLs, flags 404s, and substitutes the corrected URLs listed above; keep a `sourcePolicy` that forbids embedding images and caps quotes at 25 words.

---

## Appendix A: Full URL index (all absolute URLs)

**Task 1 — hubs & lesson indexes** (3)

- https://ieltsliz.com/ielts-writing-task-1-lessons-and-tips/
- https://ieltsliz.com/ielts-writing-task-1/
- https://ieltsliz.com/ielts-writing-task-1-faq/

**Task 1 — model answers** (28)

- https://ieltsliz.com/ielts-table-band-9-model-answer/
- https://ieltsliz.com/ielts-writing-task-1-bar-chart-model-score-9/
- https://ieltsliz.com/bar-chart-sample-answer/
- https://ieltsliz.com/ielts-map-model-answer/
- https://ieltsliz.com/ielts-writing-task-1-line-graph-model-score-9/
- https://ieltsliz.com/ielts-model-bar-chart-band-score-9/
- https://ieltsliz.com/ielts-complex-table-2017/
- https://ieltsliz.com/ielts-model-answer-bar-chart-october-2018/
- https://ieltsliz.com/ielts-pie-chart-task-1-model-score-9/
- https://ieltsliz.com/ielts-diagram-model-answer-score-9/
- https://ieltsliz.com/ielts-bar-chart-of-age-groups/
- https://ieltsliz.com/ielts-writing-task-1-future-prediction-model-answer/
- https://ieltsliz.com/ielts-line-graph-and-bar-chart-model-answer-band-9/
- https://ieltsliz.com/ielts-writing-task-1-multiple-charts/
- https://ieltsliz.com/ielts-water-supply-diagram-2015/
- https://ieltsliz.com/answer-for-ielts-writing-task-1-2016/
- https://ieltsliz.com/ielts-writing-task-1-answer-2017/
- https://ieltsliz.com/full-model-answer-to-bar-chart-lesson/
- https://ieltsliz.com/high-score-bar-chart/
- https://ieltsliz.com/ielts-bar-chart-model-answer-2023/
- https://ieltsliz.com/model-answer-for-spendings-table/
- https://ieltsliz.com/ielts-table-spending-on-items/
- https://ieltsliz.com/ielts-table-three-pie-charts-model/
- https://ieltsliz.com/ielts-charts-writing-task-1/
- https://ieltsliz.com/dec-2016-ielts-writing-task-1-sample-answer/
- https://ieltsliz.com/ielts-diagram/
- https://ieltsliz.com/ielts-writing-task-1-life-cycle-diagram/
- https://ieltsliz.com/model-answer-to-sand-dunes-diagram/

**Task 1 — lessons, language & practice** (43)

- https://ieltsliz.com/writing-task-1-report-structure/
- https://ieltsliz.com/writing-task-1-paragraphs/
- https://ieltsliz.com/writing-task-1-paragraphs-review/
- https://ieltsliz.com/ielts-line-graph-vocabulary/
- https://ieltsliz.com/what-tense-to-use-in-ielts-writing-task-1/
- https://ieltsliz.com/ielts-maps-vocabulary/
- https://ieltsliz.com/organising-information-in-bar-chart/
- https://ieltsliz.com/how-to-ielts-pie-chart-lesson/
- https://ieltsliz.com/how-to-ielts-line-graph/
- https://ieltsliz.com/vocabulary-for-accurate-data/
- https://ieltsliz.com/ielts-diagram-paragraphs-and-organisation/
- https://ieltsliz.com/ielts-diagram-introduction-overview-paragraphs/
- https://ieltsliz.com/practice-exercise-for-ielts-diagrams/
- https://ieltsliz.com/ielts-writing-task-1-introduction/
- https://ieltsliz.com/improving-ielts-writing-task-1-introduction/
- https://ieltsliz.com/introduction-paragraph-for-ielts-writing-task-1-reports/
- https://ieltsliz.com/ielts-chart-practice-for-writing-task-1/
- https://ieltsliz.com/ielts-writing-task-1-preparation-tips/
- https://ieltsliz.com/ielts-map-comparison/
- https://ieltsliz.com/ielts-writing-task-1-complex-sentence/
- https://ieltsliz.com/ielts-writing-task-1-line-graph-sentences/
- https://ieltsliz.com/grammar-ielts-writing-task-1/
- https://ieltsliz.com/ielts-writing-task-1-syonyms-practice-exercise/
- https://ieltsliz.com/answers-to-ielts-writing-task-1-synonyms-exercise/
- https://ieltsliz.com/ielts-writing-task-1-bar-chart-lesson/
- https://ieltsliz.com/answers-to-organising-bar-chart-paragraphs/
- https://ieltsliz.com/answers-to-paragraphing-options-for-writing-t1/
- https://ieltsliz.com/ielts-tips-conclusion-or-overview-for-writing-task-1/
- https://ieltsliz.com/is-the-overview-important-in-ielts-wt1-answers/
- https://ieltsliz.com/question-for-you-about-overviews/
- https://ieltsliz.com/ielts-table-future-predictions/
- https://ieltsliz.com/ielts-sand-dunes-diagram-writing-task-1/
- https://ieltsliz.com/ielts-sample-chart-for-writing-task-1/
- https://ieltsliz.com/useful-links-for-ielts-line-graph/
- https://ieltsliz.com/ielts-line-graph-practice/
- https://ieltsliz.com/ielts-line-graph-sample-answer/
- https://ieltsliz.com/ielts-bar-chart-tips-and-techniques-for-a-high-score/
- https://ieltsliz.com/ielts-bar-chart-video-transcript/
- https://ieltsliz.com/free-ielts-videos-writing-task-1/
- https://ieltsliz.com/ielts-writing-task-1-bar-chart-october-2018/
- https://ieltsliz.com/reported-ielts-writing-task-1-charts-for-january-2016/
- https://ieltsliz.com/ielts-writing-task-1-reported-19-sept-2015/
- https://ieltsliz.com/writing-task-1-reported-dec-2016/

**Task 2 — hubs & model essays (patterns only, not reproduced)** (27)

- https://ieltsliz.com/ielts-writing-task-2/
- https://ieltsliz.com/ielts-writing-task-2-model/
- https://ieltsliz.com/ielts-writing-task-2-model-1/
- https://ieltsliz.com/ielts-writing-task-2-model-essay/
- https://ieltsliz.com/ielts-writing-task-2-model-essay-2/
- https://ieltsliz.com/ielts-sample-essay/
- https://ieltsliz.com/ielts-model-essay-score-9/
- https://ieltsliz.com/ielts-model-essay-two-questions/
- https://ieltsliz.com/ielts-model-essay-2020/
- https://ieltsliz.com/ielts-model-essays-for-september-2017/
- https://ieltsliz.com/june-2017-ielts-model-essay/
- https://ieltsliz.com/march-2018-ielts-model-essay/
- https://ieltsliz.com/may-2018-ielts-writing-task-2-model-essay/
- https://ieltsliz.com/model-essay-feb-2017-ielts-writing-task-2/
- https://ieltsliz.com/model-ielts-essay-june-2020/
- https://ieltsliz.com/model-essay-for-tv-weight-problems/
- https://ieltsliz.com/model-answers-for-ielts-essays-january-2018/
- https://ieltsliz.com/ielts-agree-disagree-essay-sample-answer/
- https://ieltsliz.com/ielts-discussion-essay-model-answer/
- https://ieltsliz.com/ielts-advantage-disadvantage-model-essay/
- https://ieltsliz.com/ielts-solution-essay-band-9-model-answer/
- https://ieltsliz.com/ielts-problem-solution-essay-model-answer/
- https://ieltsliz.com/positive-or-negative-development-ielts-model-essay/
- https://ieltsliz.com/do-the-advantages-outweigh-the-disadvantages/
- https://ieltsliz.com/ielts-essay-question-answer-june-2018/
- https://ieltsliz.com/funding-music-lessons-sample-answer/
- https://ieltsliz.com/ielts-two-question-essay-feedback/

**Task 2 — skills, structure, language & marking lessons** (68)

- https://ieltsliz.com/answers-about-paragraphs-in-writing-task-2/
- https://ieltsliz.com/can-you-have-6-body-paragraphs-in-writing-task-2/
- https://ieltsliz.com/types-of-ielts-essays/
- https://ieltsliz.com/ielts-writing-task-2-band-scores-5-to-8/
- https://ieltsliz.com/ielts-writing-task-2-band-descriptors/
- https://ieltsliz.com/ielts-writing-task-2-how-to-write-an-introduction/
- https://ieltsliz.com/ielts-writing-task-2-essay-planning-tips/
- https://ieltsliz.com/how-many-paragraphs-for-an-ielts-essay/
- https://ieltsliz.com/ielts-thesis-statement-for-writing-task-2/
- https://ieltsliz.com/improving-a-thesis-statement/
- https://ieltsliz.com/ielts-writing-task-2-should-i-give-my-opinion/
- https://ieltsliz.com/ielts-writing-task-2-discussion-essay-expressions/
- https://ieltsliz.com/ielts-writing-task-2-expressing-your-opinion/
- https://ieltsliz.com/ielts-writing-task-2-instructions/
- https://ieltsliz.com/ielts-essay-instructions-agree-disagree-to-what-extent/
- https://ieltsliz.com/ielts-writing-task-2-addressing-the-task/
- https://ieltsliz.com/ielts-writing-task-2-should-ideas-be-interesting/
- https://ieltsliz.com/ielts-essay-writing-choosing-your-opinion/
- https://ieltsliz.com/ielts-opinion-essay-choosing-one-side-or-partially-agreeing/
- https://ieltsliz.com/ielts-opinion-essay-body-paragraphs/
- https://ieltsliz.com/ielts-opinion-essay-finding-main-points/
- https://ieltsliz.com/ielts-conclusion-opinion-essay/
- https://ieltsliz.com/is-a-conclusion-important-in-ielts-writing-task-2/
- https://ieltsliz.com/question-for-you-conclusion-wt2/
- https://ieltsliz.com/ielts-writing-task-2-video-lesson-conclusion-linkers/
- https://ieltsliz.com/ielts-writing-task-2-last-5-mins/
- https://ieltsliz.com/ielts-essay-introduction-content-model/
- https://ieltsliz.com/background-statement-practice-for-ielts-essays/
- https://ieltsliz.com/introduction-paragraph-feedback/
- https://ieltsliz.com/opinion-essay-introduction-feedback/
- https://ieltsliz.com/how-many-sentences-for-an-essay-introduction/
- https://ieltsliz.com/can-i-write-a-long-introduction-for-my-ielts-essay/
- https://ieltsliz.com/what-type-of-ielts-essay-is-this/
- https://ieltsliz.com/ielts-writing-task-2-paraphrasing-practice/
- https://ieltsliz.com/ielts-writing-task-2-paraphrasing-practice-2/
- https://ieltsliz.com/ielts-writing-task-2-paraphrasing-practice-no-3/
- https://ieltsliz.com/how-to-paraphrase-in-ielts/
- https://ieltsliz.com/linking-words-for-writing/
- https://ieltsliz.com/practice-with-linking-words/
- https://ieltsliz.com/test-yourself-with-linking-words/
- https://ieltsliz.com/linking-words-practice-2020/
- https://ieltsliz.com/linking-words-practice-aug-2018/
- https://ieltsliz.com/answers-to-august-linking-word-practice/
- https://ieltsliz.com/ielts-writing-task-2-practice-with-linking-words/
- https://ieltsliz.com/ielts-writing-task-2-connecting-sentences/
- https://ieltsliz.com/improving-sentences-for-ielts-writing-task-2/
- https://ieltsliz.com/improving-sentences-for-academic-writing/
- https://ieltsliz.com/using-the-passive-voice-for-giving-opinion-in-writing-task-2/
- https://ieltsliz.com/punctuation-practice-for-writing/
- https://ieltsliz.com/ielts-writing-tips-sentences-to-avoid/
- https://ieltsliz.com/using-quotes-or-idioms-in-your-ielts-essay/
- https://ieltsliz.com/writing-skills-proof-reading-practice/
- https://ieltsliz.com/writing-skills-spotting-mistakes-3/
- https://ieltsliz.com/how-to-put-examples-in-your-essay/
- https://ieltsliz.com/deleting-words-in-ielts-writing/
- https://ieltsliz.com/answers-about-deleting-word-in-ielts-writing/
- https://ieltsliz.com/ielts-essay-correction/
- https://ieltsliz.com/ielts-writing-task-2-faq/
- https://ieltsliz.com/finding-ideas-for-ielts-writing-task-2/
- https://ieltsliz.com/common-essay-topics-for-ielts/
- https://ieltsliz.com/ielts-essay-topics-for-2026/
- https://ieltsliz.com/ielts-essay-topics-2021/
- https://ieltsliz.com/ielts-writing-task-2-essay-topics-2024/
- https://ieltsliz.com/new-ielts-essay-topics-for-2023/
- https://ieltsliz.com/ielts-writing-task-2-topic-computer-games/
- https://ieltsliz.com/technology-topic-for-writing-task-2/
- https://ieltsliz.com/the-environment-topic-for-writing-task-2/
- https://ieltsliz.com/tourism-and-the-local-community/

**Task 2 — question banks & instruction-type pages** (16)

- https://ieltsliz.com/2017-ielts-writing-task-2-questions/
- https://ieltsliz.com/december-2017-ielts-writing-task-2-questions/
- https://ieltsliz.com/ielts-writing-task-2-questions-june-2017/
- https://ieltsliz.com/march-april-ielts-writing-task-2-questions/
- https://ieltsliz.com/july-2018-ielts-essay-questions/
- https://ieltsliz.com/ielts-essay-questions-jan-feb-2019/
- https://ieltsliz.com/ielts-writing-questions-july-2016/
- https://ieltsliz.com/ielts-writing-questions-september-2017/
- https://ieltsliz.com/ielts-essay-ideas-for-february-2017/
- https://ieltsliz.com/opinion-essay-sample-questions/
- https://ieltsliz.com/discussion-essay-sample-questions/
- https://ieltsliz.com/ielts-advantage-disadvantage-sample-essay-questions/
- https://ieltsliz.com/ielts-solution-essay-sample-questions/
- https://ieltsliz.com/ielts-direct-questions-sample-essay-titles/
- https://ieltsliz.com/ielts-writing-task-2-current-essay-question-jan-2015/
- https://ieltsliz.com/ielts-writing-task-2-current-topic-1/

**Task 2 — topic idea pages** (13)

- https://ieltsliz.com/ielts-essay-ideas-advertising-to-children/
- https://ieltsliz.com/ielts-essay-ideas-female-staff-in-senior-positions/
- https://ieltsliz.com/ielts-essay-ideas-is-history-a-waste-of-time/
- https://ieltsliz.com/essay-ideas-about-salaries/
- https://ieltsliz.com/essay-ideas-banning-mobile-phones/
- https://ieltsliz.com/essay-ideas-littering-in-cities/
- https://ieltsliz.com/employment-competition-essay-ideas/
- https://ieltsliz.com/recent-ielts-essay-question-international-aid/
- https://ieltsliz.com/traffic-pollution-problems-essay-ideas/
- https://ieltsliz.com/city-housing-and-trees-essay-question/
- https://ieltsliz.com/handwriting-essay-ideas/
- https://ieltsliz.com/the-function-of-schools/
- https://ieltsliz.com/ideas-ielts-essays-ideas-ielts-speaking/

**Task 2 — 100 IELTS Essay Questions topic bank** (22)

- https://ieltsliz.com/100-ielts-essay-questions/
- https://ieltsliz.com/100-ielts-essay-questions/art/
- https://ieltsliz.com/100-ielts-essay-questions/business-and-money/
- https://ieltsliz.com/100-ielts-essay-questions/communication-and-personality/
- https://ieltsliz.com/100-ielts-essay-questions/crime-and-punishment/
- https://ieltsliz.com/100-ielts-essay-questions/education/
- https://ieltsliz.com/100-ielts-essay-questions/environment/
- https://ieltsliz.com/100-ielts-essay-questions/family/
- https://ieltsliz.com/100-ielts-essay-questions/food-essay-titles/
- https://ieltsliz.com/100-ielts-essay-questions/government-and-politics/
- https://ieltsliz.com/100-ielts-essay-questions/health/
- https://ieltsliz.com/100-ielts-essay-questions/housing-and-buildings-questions/
- https://ieltsliz.com/100-ielts-essay-questions/language/
- https://ieltsliz.com/100-ielts-essay-questions/leisure-free-time-essay-titles/
- https://ieltsliz.com/100-ielts-essay-questions/media-and-advertising/
- https://ieltsliz.com/100-ielts-essay-questions/society/
- https://ieltsliz.com/100-ielts-essay-questions/space-exploration/
- https://ieltsliz.com/100-ielts-essay-questions/sport-and-exercise/
- https://ieltsliz.com/100-ielts-essay-questions/technology/
- https://ieltsliz.com/100-ielts-essay-questions/tourism/
- https://ieltsliz.com/100-ielts-essay-questions/transport-traffic/
- https://ieltsliz.com/100-ielts-essay-questions/work/

**Rules, scoring, word count & computer test** (19)

- https://ieltsliz.com/ielts-writing-scoring/
- https://ieltsliz.com/ielts-writing-task-1-band-scores/
- https://ieltsliz.com/how-many-words-ielts-writing/
- https://ieltsliz.com/ielts-penalty-for-writing-under-word-count/
- https://ieltsliz.com/ielts-tips-how-words-are-counted/
- https://ieltsliz.com/do-you-understand-how-words-are-counted-in-ielts/
- https://ieltsliz.com/counting-words-questions/
- https://ieltsliz.com/answers-to-word-count-questions/
- https://ieltsliz.com/ielts-answer-sheet-writing/
- https://ieltsliz.com/computer-delivered-ielts-pros-cons/
- https://ieltsliz.com/ielts-gt-academic-writing-differences/
- https://ieltsliz.com/should-i-indent-my-paragraphs-in-ielts-writing/
- https://ieltsliz.com/is-cursive-writing-recommended-for-ielts/
- https://ieltsliz.com/capital-letters-in-ielts-will-it-affect-your-score/
- https://ieltsliz.com/ielts-writing-task-2-essay-length-2/
- https://ieltsliz.com/ielts-writing-task-2-video-lesson-essay-length/
- https://ieltsliz.com/uncountable-nouns-word-list/
- https://ieltsliz.com/practice-with-uncountable-nouns/
- https://ieltsliz.com/answers-for-uncountable-practice/

**Other crawled writing-adjacent URLs (checked, not used as evidence)** (3)

- https://ieltsliz.com/answers-to-bar-chart-model-lesson/
- https://ieltsliz.com/free-lessons-for-wt1-introduction-paragraph/
- https://ieltsliz.com/ielts-writing-task-2-ielts-video-lesson-writing-task-2/

_Total URLs crawled (HTTP 200): 242._

---

## Appendix B: Glossary

| Term | Meaning (IELTS Liz usage) |
|---|---|
| **Task Achievement (TA)** | Task 1 marking criterion: information, overview, key features, accuracy (25%) |
| **Task Response (TR)** | Task 2 marking criterion: addressing the task, position, idea development, conclusion (25%) |
| **Coherence & Cohesion (CC)** | Organisation, paragraphing, linking, referencing (25% of each task) |
| **Lexical Resource (LR)** | Vocabulary range, collocation, spelling, word formation (25%) |
| **Grammatical Range & Accuracy (GRA)** | Sentence structures, tenses, punctuation, error density (25%) |
| **Overview** | T1 paragraph collecting all key features; compulsory; starts with "Overall," |
| **Key feature** | Highest/lowest, biggest change, biggest difference, stability, crossover, key stages |
| **Report** | T1's text type (factual, no opinion, no conclusion) |
| **Background statement** | Intro sentence 1: a paraphrase of the essay question |
| **Thesis statement** | Intro sentence 2: your answer/position or preview of main points |
| **Position** | Your opinion; must be clear, explicit ("I think/in my opinion") and consistent |
| **Partial agreement / balanced view** | A specific, quantified opinion that is neither total agreement nor fence-sitting |
| **Outweigh essay** | Adv/disadv variant that requires choosing a stronger side (opinion essay in disguise) |
| **Direct question essay** | One, two (usually) or three questions to answer in one essay |
| **Topic sentence** | First sentence of a body paragraph announcing its single main idea |
| **Supporting point** | Reason/example/consequence that extends the main idea |
| **Cohesive device** | Linker, pronoun reference or signpost connecting information |
| **Referencing** | Using this/it/these/that to point back to nouns |
| **Collocation** | Verb+noun / adjective+noun pairing that sounds natural ("do cycling", "take part in") |
| **Paraphrase** | Re-stating source wording without copying; must not change meaning |
| **Memorised answer** | Pre-learned essay/sentences; risks band 0 or TR/LR penalties |
| **Penalty (word count)** | Fixed band-5 rule for under-length writing — now removed; underdevelopment still costs marks |
| **CBT / CD IELTS** | Computer-delivered IELTS; same test and marking as paper; 2-min listening check instead of 10-min transfer |
| **Answer sheet** | Official writing booklet (paper test); used to estimate words per line |
| **Band score** | 0–9 in half bands; task score = mean of 4 criteria rounded up to nearest 0.5 |
| **Overall writing score** | (T1 + 2 × T2) ÷ 3, rounded to nearest 0.5 |
| **Mixed task** | T1 with 2–3 charts/tables; one intro, one overview, bodies split by chart |
| **Cycle diagram** | Process whose final stage returns to the start (e.g. water cycle, life cycle) |
| **Future forms** | is predicted/forecast/projected to; will — used for future-dated charts |
| **Present perfect (maps)** | "there has been considerable development" for change from past until now |
| **Units are measured in …** | Intro sentence used to state units of measurement |
| **Partitive** | Unit used to quantify uncountables: a piece of information/equipment, an item of clothing |
| **Mechanical linking** | Over-use of Firstly/Secondly/etc., penalised at CC band 7+ |
| **evidenceSpan** | App-specific: exact character range of the user text that a feedback item refers to |

---

_Document ends. Generated as an agent-readable research dossier from ieltsliz.com on 2026-09-21. Verify all rubric wording against the current official IELTS band-descriptor PDFs before user-facing use._
