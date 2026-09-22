# VoidUltra

A private, offline-first micro-journaling app styled like a social media timeline — but only you can ever see it.

## Overview

VoidUltra is a React Native (Expo) journaling app built to look and feel like a social feed (a scrolling timeline, threads, posts with attachments) while keeping every byte of data on-device. There is no backend, no cloud sync, and no account system — journal entries, media, and app state all live in local SQLite storage and the device filesystem, and the timeline can be locked behind Face ID / Touch ID / passcode.

## Problem it solves

Social apps make it easy to impulsively overshare, and traditional journaling apps often don't feel engaging enough to build a daily habit. VoidUltra targets that gap: it gives users a familiar, scrollable, social-feed-like interface for capturing daily thoughts, moods, and media privately, so they get the habit-forming UX of social media without the audience, the cloud storage, or the privacy risk.

## Key features

- **Social-feed-style timeline** (`TimelineScreen`, `DayFeedScreen`) for browsing entries by day, with a compose flow (`ComposeModal`) for creating new posts
- **Threaded entries** (`ThreadScreen`) — entries can be expanded into threaded follow-up thoughts rather than being single flat posts
- **Rich attachments** — photos, videos (with thumbnail generation via `expo-video-thumbnails`), documents, and audio playback (`AudioPlayer` component, `expo-av`/`expo-video`)
- **Biometric-gated privacy** — `expo-local-authentication` locks the journal behind Face ID/Touch ID/passcode
- **Calendar and search** — `CalendarScreen` for jumping to a specific date, `SearchScreen` for finding past entries, `FavoritesScreen` and `ReflectionsScreen` for surfacing highlights
- **Local export** — `jszip` + `expo-sharing`/`expo-file-system` support exporting/sharing journal data as an archive
- **Guided onboarding & demo mode** — `OnboardingScreen` plus a `DemoContext`/`GuidedDemo` component that walks new users through the app with sample content
- **Theming** — light/dark theme support via Redux (`themeSlice`) and a dedicated `theme/` module, defaulting to a dark "Digital Zen" aesthetic

## What's unique about it

- **Zero-backend architecture by design, not by omission**: everything — posts, media references, settings — is persisted locally via `expo-sqlite` and the filesystem. There is no API layer, which eliminates hosting cost and any possibility of server-side data exposure.
- **Social-app UX applied to a private, single-user product**: the interaction model (feed, threads, compose modal, attachments) is deliberately borrowed from social media so the app feels familiar and habit-forming, while the trust model is the opposite of social media (nothing ever leaves the device).
- **Biometric-first privacy model**: the timeline itself is blurred/locked by biometrics rather than privacy being an afterthought bolted onto a generic notes app.

## Tech stack

- React Native 0.81 / React 19, via **Expo SDK 54**
- **React Navigation** (native-stack + bottom-tabs)
- **Redux Toolkit / react-redux** for theme and app state
- **expo-sqlite** for local structured storage, **expo-file-system** for media storage
- **expo-local-authentication** for biometric lock, **expo-image-picker** / **expo-document-picker** / **expo-video** / **expo-video-thumbnails** / **expo-av** for media capture and playback
- **react-native-reanimated**, **expo-haptics** for feed interactions/animations
- **jszip** for local data export

## Setup / running instructions

Requires Node.js and the Expo CLI toolchain.

```bash
npm install
npm start        # opens Expo dev tools / Metro bundler
npm run android   # run on Android emulator/device
npm run ios       # run on iOS simulator (macOS only)
npm run web       # run in a browser
```
