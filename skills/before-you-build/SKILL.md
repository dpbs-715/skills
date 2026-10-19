---
name: before-you-build
description: Assess product risk before building a new product, MVP, launch asset, internal tool, agent workflow, or major feature when demand, value, or adoption is uncertain. Identify the main assumption, existing evidence, and smallest validation action. Skip routine fixes, already validated work with clear acceptance criteria, and uncertainty limited to code, data, or API implementation. The lead agent or product manager can apply this skill directly; delegation is optional.
---

# Before You Build

Run a compact pre-mortem before implementation to identify the highest-risk assumption and the smallest useful validation step. Use existing evidence and keep effort proportional to the decision. Recommend a smaller build scope when useful; do not turn missing evidence into an automatic approval gate or override the user's instruction to proceed.

## Establish The Decision

Identify the intended user, desired outcome, confirmed requirements, and unresolved product assumption from the conversation and available material. Separate evidence from guesses; missing information is not proof that demand is absent.

For scope and implementation decisions, also follow [Build What's Needed]({{REPO_ROOT}}/rules/engineering/topics/build-what-is-needed.md). This assessment complements that rule; it does not replace its scope check.

## Risk Checklist

Choose the risks that could change this decision:

- **Demand:** Is there evidence that a specific buyer or user urgently wants this?
- **Positioning:** Can the target user understand what it is and why it matters in one sentence?
- **Value:** Is there a credible benefit that justifies adoption and maintenance? For commercial products, also consider payment and budget.
- **Repeat use:** For recurring work, is there a reason users would return?
- **Trust:** Does success depend on credibility, data access, integrations, or behavior change that users may resist?
- **Reach:** How will intended users discover and start using it? Explore distribution channels when external reach matters.
- **Feature adoption:** Will the feature improve an existing workflow, and what observable behavior would show that?

For internal tools and business features, focus on workflow pain, time or error savings, adoption, and relevant trust concerns. For commercial products and public launches, expand into positioning, monetization, retention, and distribution where relevant. One-time tools do not need a recurring-use story. Avoid filling every category mechanically.

If the verdict is not obvious, use `references/risk-checklist.md` for deeper questions.

## Output Format

Default to three short points, integrated into the existing brief when there is one:

1. **Main uncertainty:** The single product assumption most likely to change the decision.
2. **Existing evidence:** What supports it, and what remains unknown.
3. **Smallest validation action:** One concrete way to learn, with an observable success signal; use a reduced implementation slice if it is the cheapest useful validation.

Add a risk level or deferred scope only when it helps a decision or the user requests it. If evidence already establishes the need and acceptance criteria are clear, state that briefly and continue implementation without a separate risk report.

## Guidance

- Be direct about weak evidence, but avoid dismissing the user's idea.
- Prefer smaller validation steps over large research plans.
- Separate product risk from engineering difficulty.
- If the idea is already validated, say what evidence makes it lower risk and suggest the smallest implementation slice.
- If facts are missing, name the missing evidence instead of inventing market claims.
