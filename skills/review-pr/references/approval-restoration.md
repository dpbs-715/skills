# Approval restoration

Read this when an earlier LGTM or approval by the authenticated account exists
for the reviewed head and base, but the account's formal approval is now
absent, dismissed, or revoked.

Read any dismissal reason and new discussions, and revalidate the passing review
and permission before restoring the approval. Unresolved blocking objections
prevent restoration. Unknown approval state must be reported rather than treated
as active or absent.

When eligible, restore the formal approval without reposting the LGTM text:

- GitHub: submit a new approval review with a short restoration note and the
  reviewed revision, since approval is itself a review.
- GitLab: use the guarded `glab mr approve <iid> --repo <project-url> --sha <reviewed-head>`
  command from step 3 without another LGTM note. A SHA mismatch means the head
  changed: return to steps 2 and 3 for the new revision.

Verify the resulting active approval state before continuing.
