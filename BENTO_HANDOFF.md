# Bento English — Project Handoff
**Last updated:** July 7, 2026  
**Status:** Live and functional  
**Built by:** Claude (Anthropic) across multiple sessions with Guilherme

---

## 🌐 Live URLs
| Service | URL |
|---|---|
| **Student site** | https://bento-class-2-0.onrender.com |
| **Teacher dashboard** | https://bento-class-2-0.onrender.com/professor.html |
| **GitHub repo** | https://github.com/GuiBRA985/Bento-Class |

---

## 🏗 Architecture

```
GitHub (static files)
  └── Render (Static Site — auto-deploy on push)
        ├── login.html
        ├── index.html (student dashboard)
        ├── aula.html (lesson page)
        ├── professor.html (teacher dashboard)
        └── aula-teste.html (navigation test only)

Supabase (kqggtikhgzvzreiraosi)
  ├── Auth (email + password, no email confirmation)
  ├── Database
  │     ├── students
  │     ├── lessons
  │     └── lesson_results
  └── Edge Functions
        ├── evaluate-pronunciation
        └── (generate-lesson — created but not yet deployed)

External APIs (free, no key needed)
  └── dictionaryapi.dev (IPA, definition, native audio)
```

---

## 🗄 Database Schema

```sql
-- Students (linked to Supabase Auth)
create table students (
  id         uuid primary key,  -- same as auth.users.id
  name       text not null,
  role       text default 'student',  -- 'student' | 'teacher'
  email      text,
  created_at timestamptz default now()
);

-- Lessons (39 rows populated — Closed Syllables group)
create table lessons (
  id         uuid primary key default gen_random_uuid(),
  group_name text not null,
  subgroup   text not null,
  pattern    text not null,
  words      jsonb not null,      -- array of strings
  sentences  jsonb not null,      -- array of strings
  created_at timestamptz default now(),
  unique(group_name, subgroup)
);

-- Lesson Results
create table lesson_results (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid references students(id),
  lesson_id       uuid references lessons(id),
  score           integer default 0,
  words_correct   integer default 0,
  words_total     integer default 0,
  sents_correct   integer default 0,
  sents_total     integer default 0,
  ocr_text        text,
  completed_at    timestamptz default now()
);
```

### RLS Policies (active)
- `lessons` — SELECT for `anon` and `authenticated`
- `students` — SELECT for `authenticated` (all rows)
- `students` — INSERT for `authenticated` (own row only)
- `lesson_results` — SELECT for `authenticated` (all rows)
- `lesson_results` — INSERT for `authenticated` (own row only)

---

## 📁 Files

### login.html
- Supabase Auth sign in / sign up
- No email confirmation required
- On signup: inserts row into `students` table with `role = 'student'`
- Redirects to `index.html` on success

### index.html (Student Dashboard)
- Checks Supabase Auth session → redirects to `login.html` if not logged in
- Checks `students.role` → redirects to `professor.html` if `teacher`
- Shows current block progress (Short Vowels — 5 subgroups)
- Stats: lessons completed, avg score, total words
- "Enter Lesson" button → `aula.html`

### aula.html (Lesson Page)
4-phase lesson flow:

**Phase 1 — Words**
- Fetches random lesson from Supabase (`group_name = 'Closed Syllables'`, `subgroup LIKE 'Short Vowels%'`)
- Restores session from localStorage if page was refreshed mid-lesson
- Each word has 4 buttons:
  - 🔊 Listen (Web Speech API TTS, en-US, rate 0.85)
  - 🔤 Spell (spells letter by letter)
  - 🎙 Record (Web Speech Recognition → Supabase Edge Function `evaluate-pronunciation`)
  - 📖 Define (Dictionary API → shows IPA, part of speech, definition, example, native audio)
- All words must be marked done to advance

**Phase 2 — Handwriting**
- Shows all sentences for student to copy on paper
- Student takes photo → Tesseract.js OCR runs in browser (free, no server)
- Checks if all sentences appear in photo (70% word match threshold)
- Always advances if OCR finds handwriting

**Phase 3 — Read Aloud**
- Each sentence has a 🎙 Record button
- Sends to `evaluate-pronunciation` Edge Function
- All sentences must be completed to advance

**Phase 4 — Final Evaluation**
- Calls `evaluate-pronunciation` Edge Function with `mode: "evaluation"`
- Claude returns: translations (EN→PT), encouraging message, ironic handwriting comment
- Score calculated: (words_correct/words_total * 50) + (sents_correct/sents_total * 50)
- Saves to `lesson_results` table
- Clears localStorage session

**Session persistence (localStorage key: `bento_session`)**
```json
{
  "lessonId": "uuid",
  "phase": "words|handwriting|sentences|evaluation",
  "wordsDone": {},
  "sentsDone": {},
  "hwApproved": false,
  "ocrText": "",
  "selectedIdx": null,
  "wordsCorrect": 0,
  "sentsCorrect": 0
}
```

### professor.html (Teacher Dashboard)
- Dark theme (#0f172a)
- Shows all students + their lesson results
- Stats: total students, total lessons, avg score
- Per student: lessons completed, words practiced, avg score, last 8 lessons with score + date
- Score colors: green ≥80, yellow ≥60, red <60
- Uses anon key (RLS allows authenticated users to read all)

### aula-teste.html
- Navigation-only test file (no recording, no OCR)
- 25 words, 12 sentences, all 4 phases with Next buttons
- Safe to delete once testing is complete

---

## ⚡ Supabase Edge Functions

### evaluate-pronunciation
**URL:** `https://kqggtikhgzvzreiraosi.supabase.co/functions/v1/evaluate-pronunciation`

**Modes:**

`mode: "pronunciation"` (default)
```json
// Request
{ "word": "cat", "transcript": "cat" }
// Response
{ "correct": true, "feedback": "Muito bem! Sua pronúncia estava ótima!" }
```

`mode: "evaluation"`
```json
// Request
{ "word": "__eval__", "transcript": "<full prompt>", "mode": "evaluation" }
// Response
{
  "evaluation": "Parabéns por completar a aula!",
  "ironic": "Assim que a NASA retornar o que está escrito...",
  "score": 85,
  "word_translations": { "cat": "gato" },
  "sentence_translations": ["O gato gordo sentou no chapéu."]
}
```

**Secrets required:**
- `ANTHROPIC_API_KEY` — Claude API key (Anthropic Console)

**Model:** `claude-sonnet-4-6`

---

## 📚 Lesson Database (39 lessons loaded)

All in `group_name = 'Closed Syllables'`:

| Subgroup | Pattern |
|---|---|
| Consonants | b d f g h j k l m n p r s t v w x y z |
| Short Vowels a | a = /a/ |
| Short Vowels i | i = /i/ |
| Short Vowels u | u = /u/ |
| Short Vowels e | e = /e/ |
| Short Vowels o | o = /o/ |
| Sight Words | sight words set 1 |
| Consonant Blends front bl | bl- |
| Consonant Blends front br | br- |
| Consonant Blends front cl | cl- |
| Consonant Blends front cr | cr- |
| Consonant Blends front dr | dr- |
| Consonant Blends front fl | fl- |
| Consonant Blends front fr | fr- |
| Consonant Blends front gl | gl- |
| Consonant Blends front gr | gr- |
| Consonant Blends front pl | pl- |
| Consonant Blends front pr | pr- |
| Consonant Blends front sc sk | sc- sk- |
| Consonant Blends front sl | sl- |
| Consonant Blends front sm | sm- |
| Consonant Blends front sn | sn- |
| Consonant Blends front sp | sp- |
| Consonant Blends front st | st- |
| Consonant Blends front sw | sw- |
| Consonant Blends front tr | tr- |
| Consonant Blends front tw | tw- |
| Consonant Blends end ft | -ft |
| Consonant Blends end nd | -nd |
| Consonant Blends end ng | -ng |
| Consonant Blends end nk | -nk |
| Consonant Blends end nt | -nt |
| Consonant Blends end sk | -sk |
| Consonant Blends end sp | -sp |
| Consonant Blends end st | -st |
| Consonant Blends end lt | -lt |
| Consonant Blends front and end str | str- |
| Consonant Blends front and end spr | spr- |
| Consonant Blends front and end scr thr | scr- thr- |

**Remaining groups to populate (262 total lessons planned):**
- More Closed Syllables (Digraphs, ck, ng/nk, double consonants)
- Vowel Digraph Syllables (ee, ea, oo, ai, ay, oa, ou, ow, aw, oy, oi)
- Endings (silent e, -s, -es, -ed, -ing, -ful)
- Multisyllable (compound words, -er, -le, -y)
- Soft C and G
- Magic E Syllables (a_e, i_e, o_e, u_e)
- Open Syllables
- More Long Vowels (ie, ei, igh, ow, old, ue, ew)
- R-Controlled (ar, er, ir, or, ur)
- More Short Vowels (all, al, alk, oo short)
- Silent Letters & Advanced (tion, sion, ph, kn, wr)

---

## 🔑 Credentials & Config

### Supabase
- **Project:** kqggtikhgzvzreiraosi
- **URL:** https://kqggtikhgzvzreiraosi.supabase.co
- **Anon key:** in all HTML files as `SUPABASE_ANON`
- **Service role key:** needed for `generate-lesson` Edge Function (in Secrets)

### Anthropic
- **Key:** in Supabase Edge Function Secret as `ANTHROPIC_API_KEY`
- **Model:** claude-sonnet-4-6
- **Est. cost per lesson:** ~$0.025 (full lesson with all evaluations)
- **$1 ≈ 40 lessons** | **$5 ≈ 200 lessons**

### Render
- **Service:** bento-class-2-0 (Static Site)
- **Repo:** GuiBRA985/Bento-Class (main branch)
- **Build:** `echo done`
- **Publish dir:** `.`
- **Auto-deploy:** yes, on every push to main

---

## 👥 Users
| Email | Role | Name |
|---|---|---|
| gui@bento.host | teacher | Guilherme |
| (others) | student | Murillo Dias + others |

---

## 🚧 Pending / Next Steps

### High priority
1. **Populate remaining 223 lessons** — SQL files needed for all 12 groups
2. **Dashboard block progression** — unlock next block when current is 100% complete
3. **Special lesson at 100%** — reward when student completes all subgroups in a block
4. **generate-lesson Edge Function** — deploy so AI can generate new lessons on demand

### Medium priority
5. **Student progress per subgroup** — dashboard shows which subgroups are done
6. **Teacher can add students** — manual invite system
7. **Lesson history page** — student can review past lessons
8. **Audio playback of recordings** — student can hear themselves

### Low priority
9. **More lesson groups** — expand beyond Closed Syllables
10. **Pronunciation score breakdown** — phoneme-level feedback via Claude
11. **Offline mode** — service worker for lesson caching

---

## 🛠 Tech Stack
- **Frontend:** Pure HTML/CSS/JS (no framework)
- **Hosting:** Render Static Site
- **Auth:** Supabase Auth (email + password)
- **Database:** Supabase PostgreSQL
- **Edge Functions:** Supabase (Deno/TypeScript)
- **AI:** Anthropic Claude API (claude-sonnet-4-6)
- **OCR:** Tesseract.js 4.1.1 (CDN, browser-side)
- **Dictionary:** dictionaryapi.dev (free, no key)
- **Speech:** Web Speech API (browser-native)

---

## 📝 Notes for Next AI
- Guilherme works primarily from **mobile** — keep solutions mobile-friendly
- He is based in **Mato Grosso, Brazil** — Portuguese (Brazil) for UI feedback
- **Lesson content is 100% original** — not copied from any curriculum (has permission to use phonics methodology but not specific word lists from original PDF)
- When generating SQL, use **Python** to produce it (avoid em-dashes and special chars that break Supabase SQL Editor)
- The `evaluate-pronunciation` Edge Function handles both pronunciation checking AND final evaluation (mode parameter)
- Teacher dashboard uses same anon key as students (RLS allows all authenticated users to read all rows)
- **Do not use `??` operator** in Edge Function TypeScript — use `||` instead (causes parse errors in Supabase)
- Guilherme copies code on mobile — avoid special Unicode characters in code blocks
