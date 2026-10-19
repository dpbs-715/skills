# Build What's Needed

Add capability when a real need exists; carry nothing that isn't earning its place.

## Order Of Decisions

For scope decisions, implementation choices, process improvements, performance work, or automation, use this order to avoid making unnecessary work faster:

1. **Question requirements.** Identify the intended outcome and the evidence or owner behind a requirement. Separate the actual need from a proposed implementation; use confirmed user goals and constraints as the baseline.
2. **Delete unnecessary parts or steps.** Check whether removing a feature, branch, dependency, or process step would still meet the goal. Base removal on evidence about its consumers and purpose.
3. **Simplify and optimize what remains.** Choose the least complex design that meets the need before tuning its implementation.
4. **Accelerate the cycle.** Once the remaining work is justified and simple, shorten execution, build, validation, or feedback time while preserving required behavior and checks.
5. **Automate.** Automate a validated process when repetition and saved effort justify the setup and maintenance cost.

Apply the relevant steps in order; stop when the task is satisfied. This is a decision guide, not a requirement to produce a five-step report or add optimization and automation to every task. If a later step exposes an unnecessary requirement or process, revisit the earlier decision.

Use established requirements and acceptance criteria as evidence; reopen them only when new evidence reveals a conflict or missing need. An unknown API field or implementation choice calls for technical investigation, not automatically a product risk review. Follow the product risk routing in the [engineering rules entry](../RULES.md) when demand, value, or adoption is uncertain. Scope decisions and product risk assessment serve different purposes; applying one does not establish that the other was performed.

## Scope And Removal

Don't build ahead:

- No speculative features, options, or abstractions for hypothetical futures (YAGNI).
- Solve the concrete case now; generalize when a second real case actually appears.

Cut dead weight:

- Delete aspirational scaffolding that was declared but never implemented.
- Keep implemented-but-unused code that works and has a plausible consumer; remove it once it clearly has none.
