---
name: Vedra duplicate-route crash
description: Root cause and fix for the Vedra startup crash in Expo Router
---

## The rule
Never have both `app/index.tsx` and `app/(tabs)/index.tsx` in an Expo Router project — both resolve to `/` and crash the app on startup.

**Why:** Expo Router v6 treats route groups as transparent; `(tabs)/index` and `index` map to the same path `/`, creating a conflict that crashes the bundler/navigator.

**How to apply:** When adding tabs to Vedra, replace `app/index.tsx` with the tabs group (move content into `app/(tabs)/index.tsx` and add `app/(tabs)/_layout.tsx`). Do not keep both.
