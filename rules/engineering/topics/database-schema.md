# Database Schema

## Before Creating a Table

- Confirm the target database, schema (where applicable), and owning module. Check whether an existing table already owns the same business data or can support the new use case.
- Follow the target project's current schema conventions. Where they leave a choice open, inspect recent tables with a similar purpose in the same schema and module. Use migrations, schema definitions, or read-only database metadata as evidence. Compare table and column naming, key and audit field conventions, and names for constraints and indexes. Prefer comparable current examples over legacy or unrelated tables.
- If comparable examples disagree, state the convention you chose and the evidence for it. Ask for clarification if the available evidence cannot resolve a choice that affects ownership or compatibility.

## Design for the Data

- Define what one row represents and what counts as a duplicate. Use keys and constraints to enforce the required identity and uniqueness. For example, if a row represents one inventory adjustment, a warehouse and product can appear together in multiple rows; an adjustment identifier can prevent the same adjustment from being recorded twice.
- Choose types, nullability, defaults, foreign keys, soft deletion, and indexes based on the new table's data rules and expected queries. Follow project requirements for standard fields such as audit timestamps.

## Deliver and Verify

- Use the project's schema change workflow, such as its migration tool or versioned SQL.
- When a development or test database is available, run the change there and verify the resulting schema and key constraints. If a table with the same name already exists, check its definition before treating the change as applied. State what remains unverified if the change cannot be run.
