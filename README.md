# Dental Receptionist Chat

A modern dental office assistant frontend built with React, Vite, TypeScript, and Tailwind CSS. This project is designed to support a receptionist-style chat and voice assistant experience for dental clinics, helping patients with common queries, scheduling flow, and office communication.

## Overview

This repository contains a front-end application for a dental receptionist assistant with:

- conversational chat UI
- dental office workflow support
- responsive single-page app experience
- modern component system with Tailwind and shadcn-inspired UI primitives
- Vite-based development workflow

The app appears to be built around a patient support and scheduling assistant experience, with a voice-agent configuration file included in the repo (`Dental voice agent.json`).

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- TanStack Router / React Query
- Radix UI primitives
- shadcn-style components
- ESLint + Prettier

## Project Structure

```text
.
├── AGENTS.md
├── Dental voice agent.json
├── components.json
├── bun.lock
├── bunfig.toml
├── eslint.config.js
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── pages/
│   ├── styles/
│   ├── main.tsx
│   └── routes/
├── .lovable/
├── .gitignore
├── .prettierignore
├── .prettierrc
└── README.md
```

## Prerequisites

Make sure you have one of the supported package managers installed:

- Node.js 18+
- npm, pnpm, or Bun

## Installation

Using npm:

```bash
npm install
```

Using Bun:

```bash
bun install
```

## Run the app locally

Using npm:

```bash
npm run dev
```

Using Bun:

```bash
bun run dev
```

Then open the local Vite URL shown in the terminal (typically `http://localhost:5173`).

## Production build

```bash
npm run build
```

Or:

```bash
bun run build
```

Preview the production build:

```bash
npm run preview
```

## Linting and formatting

```bash
npm run lint
npm run format
```

## Notes

- This project is configured for a modern frontend workflow with Vite and React.
- The UI uses reusable components and a design system to make the dental receptionist experience consistent and polished.
- The presence of `Dental voice agent.json` suggests integration with an AI voice or assistant flow for dental support use cases.

## Important project note

The repository includes an `AGENTS.md` file with Lovable-specific guidance. If you are working in this project via connected Lovable tooling, avoid rewriting already-published Git history.

## License

No explicit project license file was found in the repository during review. If you plan to distribute or publish this project, confirm the license before releasing it publicly.
