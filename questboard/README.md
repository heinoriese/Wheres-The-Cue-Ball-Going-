# Questboard

A shared, gamified life tracker. Pure static frontend (no backend yet) — checkboxes,
delegation, grouping and the day/weather schedule all run client-side and persist to
`localStorage` in the browser.

## Run locally

```
node server.js
```

Then open http://localhost:3000

## Deploy on Railway

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In Railway, **New Project → Deploy from GitHub repo**, pick this repo.
3. In the service's **Settings → Root Directory**, set it to `questboard`.
4. Railway auto-detects `package.json` and runs `npm start` (which runs `node server.js`).
   No environment variables or database needed for this version.
5. Once deployed, Railway gives you a public `*.up.railway.app` URL — that's the live link.
   Open it on your phone and use "Add to Home Screen" (iOS Safari: Share → Add to Home
   Screen) to get an app-like icon.

## What's live vs stubbed

- **Live**: splash → pick a board, checkboxes, section progress bars, overall XP bar,
  delegation (including shared "Both" tasks), task grouping, weather-based Weather
  Bonus checklist, Side Quest rotation, Task Bank (Boss Battles + as-needed pull-ins),
  featured daily Boss Battle card, one-off "Extras" add box.
- **Stubbed**: Weekly Recap, Achievements. Placeholder panels only.
- **Data**: `public/tasks.json` is the full task bank exported from Sarah's spreadsheet.
  Edit it directly (or re-export and replace it) to change the task list.

## Known gaps / next steps

- No accounts — it's just a person-picker on the splash screen, no login.
- No push notifications yet.
- No live weather — there's a manual weather dropdown standing in for it.
- No shared backend — Sarah's and Aaron's completion state only lives in *their own*
  browser's `localStorage`, it does not sync between their phones yet. That needs a
  small database (e.g. Supabase) behind this before it's usable as a real shared app.
