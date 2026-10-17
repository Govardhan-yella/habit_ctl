# Contributing to habit_ctl

Thanks for taking the time to contribute! This project is a vanilla TypeScript + Vite app — no framework, no build magic beyond Vite.

## Getting started

```bash
npm install
npm run dev
```

Before opening a pull request, make sure the following all pass:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Guidelines

- **Keep it dependency-light.** Prefer the standard DOM/platform APIs. Discuss new dependencies in an issue first.
- **Match the existing style.** Components are plain functions/classes that build DOM and append to a root element. No framework idioms.
- **No comments unless they add value.** The codebase favors self-explanatory code.
- **Types matter.** The project runs TypeScript in `strict` mode.
- **Local-first first.** Any feature that touches user data should keep working offline; cloud features are optional and must degrade gracefully when Appwrite is unconfigured.
- **Accessibility & keyboard support** are appreciated (keyboard shortcuts live in `src/components/App.ts`).

## Commit messages

Use short, imperative subject lines (e.g. `Fix streak calculation for weekday habits`). Group related changes into one commit where practical.

## Reporting bugs / requesting features

Use the GitHub issue templates. Include steps to reproduce, expected vs. actual behaviour, browser/OS, and any console errors.

## Security

Do **not** open a public issue for security problems — see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
