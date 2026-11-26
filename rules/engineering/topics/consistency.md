# Consistency

Prefer one coherent way over locally clever variations; keep the codebase predictable.

Coherence over local tidiness:

- One entry point and one way to do a thing, rather than several siblings doing it differently.
- Honor the structure the folders and existing patterns imply; don't add an inconsistent corner.
- Derive shared facts from a single source instead of duplicating them.

Restructure deliberately:

- Diagnose the real shape first ("not ugly, just uneven") before reorganizing.
- Keep a single public entry point without turning it into a monolithic file; when an existing file or catalog has outgrown its boundary, apply the split checkpoints in [file-organization.md](file-organization.md) instead of appending to match past inertia.
