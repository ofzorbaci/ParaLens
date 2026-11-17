# CLAUDE.md — ParaLens

ParaLens (formerly Paraölçer) is an Expo app that shows the inflation-adjusted ("real") return of
the user's savings. The UI is Turkish; talk to the owner in Turkish. It is a calculation tool, not
investment advice, and no copy may suggest otherwise.

The Expo and React Native rules in AGENTS.md apply here too:

@AGENTS.md

## Project rules

- **The app should run itself.** Prefer automated, validated sources over values typed into the
  code. Anything that has to stay manual must warn before it goes stale (as `feed/withholding.json`
  does). Never fix data by hand-editing `feed/public/feed.json`, `src/data/feed-snapshot.json` or
  the `fund-data` branch; change the builder (`feed/build.mts`, `data-pipeline/`) instead.
- **Don't change the app's ids.** Expo slug `paralens`, the EAS project id in `app.json`,
  RevenueCat entitlement `paralens_premium`, the Pages URL `ofzorbaci.github.io/ParaLens` and the
  `paralens` backup id and file names. Changing one breaks installs, purchases or restores. The old
  names (`paraolcer`, `reel-getiri-pusulasi`) stay in `src/lib/backup.ts` and
  `src/lib/auto-backup.ts` so backups made before the rename still load; keep them.
- **No secrets in the repo.** Only public keys belong in `app.json`; never a RevenueCat `sk_` key,
  an API token or a `.env` file. Secrets for the data jobs live in GitHub Actions secrets.
- **No unlicensed data.** There is no free legal source for BIST stock prices; do not scrape one.
  Users enter those prices themselves.
- **The free tier never locks the user's data.** Premium sells depth (see
  `src/lib/entitlements.ts`); it must never hide or hold back holdings the user entered.
- **The owner approves every commit.** Make changes, run the checks, then stop and say what to
  test on the phone. Commit or push only after the owner says it works ("Çalışıyor, push").

## Checks

Run these before saying a change is done:

```bash
npm run typecheck
npm run lint
npm test
```

## How to work

These follow Andrej Karpathy's notes on where coding agents go wrong. The full text is the
`karpathy-guidelines` skill.

1. **Think before coding.** State assumptions; when a request can be read two ways, ask instead of
   picking one. Say so when a simpler approach exists.
2. **Simplicity first.** The least code that solves the problem: no unrequested features, no
   abstractions for a single use, no handling for cases that cannot happen.
3. **Surgical changes.** Every changed line traces to the request. Match the surrounding style,
   leave unrelated code alone, and mention dead code instead of deleting it.
4. **Goal-driven execution.** Turn the task into a check that can pass or fail (a failing test
   for a bug, tests before and after a refactor) and keep going until it passes.

For a larger change, run the `grilling` skill to settle the details with the owner before writing
code, and use `domain-modeling` to keep the project's terms consistent.
