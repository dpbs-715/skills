# Preview-only submission

Read this only when the user explicitly asks to preview, show the plan first,
or avoid submission. The whole workflow stays read-only: inspect and draft, with
no Git or remote mutations.

Missing authentication does not block a local draft; identify remote facts that
could not be verified.

Produce one consolidated plan for all groups: Issue drafts or verified existing
Issues, planned branches and bases, commit scopes and proposed messages, and
PR/MR drafts with source and target repositories. Use placeholders for Issue
numbers that do not exist yet. Apply the underlying skills' drafting guidance
without entering their write phases or stopping at separate per-skill previews.

With `then merge`, describe the review and merge conditions. With two named
targets, also follow the preview rules in
[the two-stage merge workflow](merge-chain.md).

Return the complete plan and stop. If the user later authorizes submission,
revalidate relevant state and continue without asking for the same approval
again.
