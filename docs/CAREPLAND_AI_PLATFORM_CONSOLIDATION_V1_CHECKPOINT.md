# CarePland AI Platform Consolidation v1 Checkpoint

Date: 2026-07-04

This checkpoint records the current AI platform extraction state. It is a handoff note only; it does not introduce new runtime behavior, intelligence, persistence, UI, or workflow wiring.

## Platform Pieces Now Present

- Shared platform contracts in `app/lib/platform/ai/contracts.ts`:
  - `Observation`
  - `Concept`
  - `HouseholdConcept`
  - `ResolvedConcept`
  - `IntentResult`
  - `WorkflowSelection`
  - `DecisionTrace`
- CCKL platform service in `app/lib/platform/ai/ccklService.ts`:
  - wraps the existing Consumer Care Knowledge helper
  - emits platform `Concept[]`
  - emits `DecisionTrace<"consumer_care_knowledge">`
  - preserves existing prompt context output
- Talk adapter in `app/lib/platform/ai/talkAdapter.ts`:
  - maps existing Talk interpretation output into platform `IntentResult`
  - maps existing Talk decision trace into platform `DecisionTrace<"intent_router">`
  - preserves existing snake_case persistence shape
- HKL scaffold in `app/lib/platform/ai/hklService.ts`:
  - emits empty `HouseholdConcept[]`
  - emits `DecisionTrace<"household_knowledge">`
  - uses `no_write`
- Knowledge Resolution scaffold in `app/lib/platform/ai/knowledgeResolutionService.ts`:
  - accepts `Concept[]` and `HouseholdConcept[]`
  - emits empty `ResolvedConcept[]`
  - emits `DecisionTrace<"knowledge_resolution">`
  - uses `no_write`
- Trace/result utilities:
  - `traceComposition.ts` carries CCKL, HKL, and Knowledge Resolution traces in deterministic order
  - `normalizationResult.ts` carries `Concept[]`, `HouseholdConcept[]`, `ResolvedConcept[]`, and `DecisionTrace[]`
- Existing shared OpenAI infrastructure under `app/lib/platform/ai/`:
  - `responses.ts`
  - `operationLogs.ts`
  - `usageCosts.ts`
- Platform AI import boundary:
  - `app/lib/platform/ai/index.ts`

## Current Product Consumption

- Connect call-summary prompt construction is the first non-persistence product consumer of platform CCKL.
  - It calls the platform CCKL service.
  - It still consumes only the legacy `existingContext.promptContext`.
  - Generated prompt text remains unchanged.
  - Platform `Concept[]` and CCKL `DecisionTrace` are available internally but are not persisted.
- Existing OpenAI helper infrastructure is used by current AI routes where already adopted.
  - This includes shared response parsing/request handling and operation-cost logging paths.
- Talk routing and Talk persistence are not changed.
  - The Talk adapter exists for platform-shaped output, but existing Talk runtime behavior and persisted decision traces remain unchanged.

## Intentionally Unwired

- HKL is not consumed by Talk, call summaries, persistence, UI, Admin, or any workflow.
- HKL does not resolve household aliases.
- Knowledge Resolution is not consumed by Talk, call summaries, persistence, UI, Admin, or any workflow.
- Knowledge Resolution does not merge universal and household concepts.
- Trace composition and normalization result utilities are passive containers only.
- No KnowledgeBundle exists yet.
- No Workflow Selection service/helper has been introduced.
- No new vocabulary, aliases, taxonomy, routing behavior, automation, or intelligence has been added.
- No product-facing UI or debug/admin surface has been added.

## Test Status

Latest verification in this consolidation pass:

- Command: `npm test`
- Result: passing
- Count: 276 tests, 56 suites, 0 failures

Coverage added during consolidation includes:

- platform contracts compile/type coverage
- CCKL service behavior and prompt-context preservation
- Talk adapter mapping
- HKL no-op scaffold
- Knowledge Resolution no-op scaffold
- in-memory CCKL -> HKL -> Knowledge Resolution composition
- trace composition
- normalization result container
- call-summary CCKL boundary regression coverage

## Known Seed/Data Gaps

- GoodRx supported seed text includes `good rx`; phonetic `good are ex` remains unsupported.
- HKL has no household alias data or resolver behavior.
- Household-specific examples such as `Mom's pharmacy`, `heart doctor`, `blue pills`, and provider nicknames remain intentionally unresolved.
- Knowledge Resolution currently has no merge/linking rules.
- No household-specific alias store, learned household vocabulary, or HKL persistence exists.

## Recommended Next Adoption Candidates

These are candidates only. Do not implement them without a fresh scoped objective.

- Call summary explainability:
  - optionally carry composed platform traces internally through call-summary generation without persistence.
- Talk platform emission:
  - optionally expose `talkIntentResultToPlatformIntent()` at a non-persistence boundary while preserving current routing and stored Talk trace shape.
- Admin/review analysis:
  - optionally use platform-shaped traces in tests or offline review tooling before any UI surface is introduced.
- Future HKL design:
  - define the smallest source of household alias data before any resolver behavior is added.

Recommended immediate next step: pause further platform shape work and pick one narrow adoption candidate only if it clearly reduces duplication, improves explainability, or enables another workflow to reuse the platform.
