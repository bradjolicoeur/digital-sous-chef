# Work Routing

How to decide who handles what.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|---------|
| Architecture, decisions, trade-offs | Danny | System design, feature scoping, PR review |
| .NET backend, Wolverine handlers, Marten | Rusty | API endpoints, commands, queries, projections, migrations |
| React, TypeScript, Tailwind, UI | Linus | Components, pages, routing, API integration, styling |
| Tests, quality, edge cases | Basher | xUnit, Alba integration tests, test scenarios |
| Session logging, decision merges | Scribe | Automatic — never needs routing |
| Work queue, GitHub issues, backlog | Ralph | Automatic — monitor only |

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage: analyze issue, assign `squad:{member}` label | Danny (Lead) |
| `squad:danny` | Architecture and lead work | Danny |
| `squad:rusty` | Backend API/handler work | Rusty |
| `squad:linus` | Frontend UI work | Linus |
| `squad:basher` | Testing and quality work | Basher |

### How Issue Assignment Works

1. When a GitHub issue gets the `squad` label, **Danny** triages it — analyzing content, assigning the right `squad:{member}` label, and commenting with triage notes.
2. When a `squad:{member}` label is applied, that member picks up the issue in their next session.
3. Members can reassign by removing their label and adding another member's label.
4. The `squad` label is the "inbox" — untriaged issues waiting for Lead review.

## Rules

1. **Eager by default** — spawn all agents who could usefully start work, including anticipatory downstream work.
2. **Scribe always runs** after substantial work, always as `mode: "background"`. Never blocks.
3. **Quick facts → coordinator answers directly.** Don't spawn an agent for "what port does the server run on?"
4. **When two agents could handle it**, pick the one whose domain is the primary concern.
5. **"Team, ..." → fan-out.** Spawn all relevant agents in parallel as `mode: "background"`.
6. **Anticipate downstream work.** If a feature is being built, spawn Basher to write test cases from requirements simultaneously.
7. **Issue-labeled work** — when a `squad:{member}` label is applied to an issue, route to that member. Danny handles all `squad` (base label) triage.
