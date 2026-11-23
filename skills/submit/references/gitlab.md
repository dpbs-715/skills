# GitLab host checks

Read this when the resolved host is GitLab (GitLab.com or Self-Managed),
before GitLab API reads, including in preview-only work.

For GitLab API reads in a checkout bound to the intended server, use glab's
repository context and verify the project ID and namespace. A self-managed
server can advertise a clone URL with a different hostname from the configured
remote. Verify that both identify the intended project before proceeding.

Use normal branch and MR endpoints for the current user's permissions and merge
status. Query administrative settings only when they answer an outstanding
requirement. Leave nonessential metadata to its owning skill.
