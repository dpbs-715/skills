# Branch work

Resolve the source branch, destination branch and authorized resource changes
inside the selected project. Inspect `branch --help` and the relevant operation
help; carry `--branch` on reads, mutations, and verification when supported.

For an authorized AI branch workflow, create from the intended source. AI
branches can begin without source resources; inspect them before editing.
Import only the existing resources that need modification using the current
`branch pick-to` command. Creating a new resource or referencing an unchanged
resource does not automatically require copying all its dependencies.

A successful branch creation does not prove later writes are permitted.
When the CLI reports external-AI permission restrictions, present the concrete
choices: change the applicable permission in Apifox, or use an authorized AI
branch workflow. Do not switch credentials or projects to evade the restriction.

Verify edits on the same branch. Before integration inspect the merge preview,
source, destination and conflicts. Creating a branch or editing resources does
not itself authorize a merge or merge request. Honor a request that already
includes that integration; otherwise ask once with the concrete preview. Use
merge requests where branch protection requires them. Report unmerged work
explicitly and do not delete/archive branches as unsolicited cleanup.
