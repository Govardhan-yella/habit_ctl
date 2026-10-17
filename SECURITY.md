# Security Policy

## Supported versions

The latest commit on the default branch is supported. There are no maintained
release branches at this time.

## Reporting a vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, use GitHub's private vulnerability reporting ("Security" tab →
"Report a vulnerability") or contact the maintainer directly via the email on
their GitHub profile. Include:

- A description of the issue and its impact
- Steps to reproduce (proof of concept if possible)
- Affected version/commit
- Any suggested remediation

You can expect an acknowledgement within a few days. Please give a reasonable
window to address the issue before any public disclosure.

## Scope

`habit_ctl` is a local-first client-side app. Most notable risks:

- **Client-side secrets.** Never put API keys or secrets in `VITE_*` variables —
  Vite embeds them in the client bundle. Only the Appwrite *endpoint* and
  *project ID* belong there (both are public).
- **Stored data.** User data lives in the browser (IndexedDB). The optional
  passcode lock is a convenience gate, not encryption at rest.
- **Third-party services.** Cloud sync relies on Appwrite; report Appwrite
  platform issues to Appwrite.

## Secrets hygiene

- Real credentials belong in `.env` (git-ignored). Only `.env.example` is tracked.
- If you believe a secret was committed, rotate it immediately and open a
  private report so history can be cleaned.
