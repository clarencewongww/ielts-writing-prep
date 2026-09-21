# IELTS Academic Writing — Phase 2 Full Bank

Version **1.0-full** · generated **2026-09-21** · 58 items · 174 reference answers.

This directory is the assembled Phase 2 content bank for the IELTS prep app. It merges the 28 Task 1
chart specifications with 84 Task 1 reference answers (bands 6/7/8) and the 30 Task 2 prompts with
90 Task 2 reference essays (bands 6/7/8).

| File | What it is |
|---|---|
| `manifest.json` | Counts, ID schemes, targets, banned phrases, file hashes and validation results |
| `task1.json` | 28 Task 1 items: chart spec + `referenceAnswers[3]` (bands 6/7/8) |
| `task2.json` | 30 Task 2 items: prompt spec + `referenceAnswers[3]` (bands 6/7/8) |
| `task1.md` | Human mirror of `task1.json` (statement, data summary, key features, grouping, answers) |
| `task2.md` | Human mirror of `task2.json` (statement, instruction, seed ideas, essays with feedback) |
| `README.md` | This file |

## Contract

**JSON.** `task1.json` and `task2.json` are pure JSON: `JSON.parse`/`json.loads` succeeds, no `//` or `/*`
comments, UTF-8, 2-space indentation. Top-level schema:

```json
{ "schemaVersion": "1.0", "task": 1, "items": [ /* 28 Task 1 items */ ] }
{ "schemaVersion": "1.0", "task": 2, "items": [ /* 30 Task 2 items */ ] }
```

**IDs.**

- Task 1 item: `t1-{type}-{nn}-{slug}` — `^t1-(line|bar|pie|table|map|process|mixed)-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$`
- Task 1 answer: `{itemId}-b{band}` — `^...-b[678]$`
- Task 2 item: `t2-{family}-{topic}-{nn}` — `^t2-(opinion|discussion|adv-disadv|outweigh-posneg|solution-cause-effect-direct)-[a-z0-9]+(?:-[a-z0-9]+)*-\d{2}$`
- Task 2 answer: `{promptId}-b{band}` with an explicit `band` field on each reference answer.

**Counts.** Task 1: 28 items = 4 × 7 types. Task 2: 30 items = 6 × 5 families = 10 variants × 3,
covering 20 topics with no topic used more than twice. Reference answers: 84 Task 1 + 90 Task 2 = 174.

**Word targets.** Task 1 answers 170–190 words (hard ceiling 210; IELTS minimum 150). Task 2 essays
270–290 words (hard ceiling 300; IELTS minimum 250). Every `wordCount` field equals `len(text.split())`.

**Time targets.** Task 1: 20 minutes recommended; Task 2: 40 minutes recommended; session total 60 minutes.

**Structures.** Task 1 items: introduction + overview + two body paragraphs, **no conclusion**; the overview
is data-free and starts `Overall,`; every body sentence carries a figure or date; spec guidance lives in
`groupingStrategy`. Task 2 items: introduction + 2–3 body paragraphs + conclusion (`In conclusion`,
`To conclude` or `To sum up`).

**Band budget.** Each item ships exactly three reference answers at bands 6, 7 and 8. Band 8 answers are the
models; band 7 answers are strong but limited; band 6 answers contain deliberate, described defects. Every
answer carries a defect profile / why-band note plus a feedback starter with a verbatim evidence span so the
grader can show users exactly which sentence cost marks. Do not edit any one band without checking the
defect profile, because the profiles are the expected failure modes for the grader.

**Banned phrases (12).** The Task 2 prompt-spec list is shipped on every item and repeated in the manifest.
None of the memorised phrases appear in any statement, instruction, seed idea, essay or answer:

1. this essay will discuss both sides and give an opinion at the end
2. i shall put forth my arguments to support my views in the following paragraphs
3. with the development of science and modern technology
4. nowadays / in the modern era / since the dawn of time
5. this is a highly controversial issue
6. the crux of the discussion is
7. research indicates that / a recent study from the IMF showed that
8. it can broaden a person's horizons
9. there are good grounds to argue in favour of / it cannot be denied that
10. in a nutshell
11. the aforementioned arguments offer insights into vindications for the impression that
12. idioms, quotes and proverbs (e.g., every coin has two sides)

Task 1 answers are additionally free of conclusion and memorised-report language (`In conclusion`,
`To conclude`, `This essay will`, `Nowadays`, etc.), because Task 1 needs an overview, not a conclusion.

## Validation checklist (run 2026-09-21)

| Check | Result |
|---|---|
| `python3 -m json.tool` on manifest/task1/task2 | PASS |
| Item counts 28 / 30 / 174 answers | PASS |
| IDs unique and regex-valid (58 items, 84 answers) | PASS |
| Bands 6/7/8 present on every item | PASS |
| Word windows 170–190 / 270–290 | PASS |
| `wordCount` matches text | PASS |
| 12 banned phrases absent | PASS |
| Pie slices sum 100 (per year) | PASS |
| Table row totals and % change arithmetic | PASS |
| T1 structure (intro + overview + 2 bodies, no conclusion) | PASS |
| T2 structure (intro + 2–3 bodies + conclusion) | PASS |
| Task 1 key features ≥ 2 and non-empty grouping strategy | PASS |
| No JS-style comments in JSON | PASS |
| Liz verbatim overlap < 25 words (longest measured run: 10 words) | PASS |
| Feedback evidence spans are exact substrings | PASS |

### Spec conflicts fixed during assembly

The bank is assembled from validated parts, but three spec-text claims contradicted their own data and were
corrected in `task1.json` (reference-answer prose was left untouched; the answers were already accurate):

1. **`t1-table-03-food-consumption`** — the grouping note called Italy/France/Germany "the three countries
   with the highest overall consumption", but Spain's total (370 kg) exceeds France's (353 kg). The corrected
   grouping follows dietary profile and states the Spain/France relationship explicitly.
2. **`t1-mixed-03-local-food-shopping`** — the key features called bread's +14 points the largest increase,
   but vegetables rose +16 points (32% to 48%). Corrected: bread = fastest *relative* growth (about
   two-thirds, 21% to 35%); vegetables = largest *absolute* rise (+16 points).
3. **`t1-mixed-01-tourism-trends`** — the key feature said total visitor numbers were higher in 2023 than in
   2019, but the combined figure is 22.3m against 22.6m. Corrected to "almost recovered", matching the
   reference answers, which only claim Asia passed its 2019 level.

These are recorded in `manifest.json` under `validation.fixesApplied`.

## Fair-use policy

- Not affiliated with IELTS Liz or Elizabeth Ferguson. `research/ieltsliz-writing-academic-deep-research.md`
  is a fair-use research summary for internal app design: prose is paraphrased, direct quotes are capped at
  **≤25 words** and linked in the dossier, and **no model essay or model report is reproduced in full**.
- This bank contains **original app-written content**. It reproduces no IELTS Liz model answer, no Cambridge
  material and no third-party chart image. The longest measured verbatim run shared with the dossier is
  **10 words** — a standard E1 instruction wording ("why is this happening and what measures can be taken") — which is
  below the dossier's 25-word direct-quote cap. All statements, chart data, seed ideas, model answers and
  feedback were written for this app.
- If any dossier quotation is surfaced to end users, attribute and link to the source page. Copyright
  © Elizabeth Ferguson, 2014–2026, all rights reserved.

## Chart image policy

`chartImagePolicy` on every Task 1 item is **`render-in-app; do not hotlink source images`**. The app must
generate its own charts from the `series`/`slices`/`cells`/`changes`/`stages` data and label them as
app-generated recreations, not official IELTS charts (`sourceConvention`). Never hotlink or embed images
from ieltsliz.com or any Cambridge publication.
