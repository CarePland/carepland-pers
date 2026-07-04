# Consumer Care Knowledge Layer

Last updated: 2026-06-26

The Consumer Care Knowledge Layer (CCKL) helps CarePland interpret ordinary consumer and caregiver healthcare language. It is not a medical encyclopedia, diagnosis engine, clinical decision support system, or transcript store.

CarePland should understand more than it records. CCKL can help the assistant interpret words like `PillPack`, `walker`, `GoodRx`, `prior auth`, `MyChart`, or `compression socks`, while summaries and saved records still include only care-relevant facts actually discussed. When uncertain, omit.

## Phase 1 Shape

The first implementation is intentionally small and code-native:

- Seed entries live in `app/lib/personal/consumerCareKnowledge/index.ts`.
- `findConsumerCareKnowledgeMatches()` finds relevant entries in transient text.
- `buildConsumerCareKnowledgeContext()` returns reusable matched terms, match details, and prompt context for any workflow.
- `buildConsumerCareKnowledgePromptContext()` creates a bounded prompt block with privacy and non-clinical guardrails.
- The proposed platform normalization prompt lives in `ai-prompts/consumer_care_knowledge_layer/`.
- Connect call care summaries now inject only matched CCKL entries at summary time.

This avoids creating an admin workflow or new database table before the model, taxonomy, review needs, and prompt behavior stabilize.

## Knowledge Model

Each entry should have:

- `canonicalTerm`: preferred internal label.
- `conceptId`: stable platform identifier for downstream systems.
- `aliases`: common spellings, brand variants, shorthand, and likely transcript variants.
- `consumerPhrases`: natural phrases a caregiver might say.
- `category`: broad consumer-care taxonomy.
- `careRelevance`: why this may matter for caregiving or appointment preparation.
- `interpretationGuidance`: how the AI should understand the term without over-inferring.
- `transcriptNormalizationHints`: likely normalization/correction hints.
- `summaryGuidance`: what may be summarized or stored if actually discussed.
- `examples`: optional realistic use cases.
- `confidenceNotes`: ambiguity and confidence cautions.
- `sourceUrls`: reputable sources used to ground the entry.

Do not add diagnosis criteria, treatment instructions, medication dosing guidance, or exhaustive clinical facts.

For branded services, plans, PBMs, portals, and acronyms, include spoken or phonetic aliases when they are common or user-observed. Example: `G.E.H.A` should include `GEHA`, `G E H A`, `gee ha`, and `ghee hah` so transcript interpretation can recognize the likely branded identity without storing a new fact.

Concept IDs should be stable and domain-scoped, such as `insurance_access.geha`, `medication_access.goodrx`, or `mobility_equipment.walker`. Downstream modules should prefer concept IDs over display strings.

## Taxonomy

Phase 1 categories:

- `medication_adherence`: packaging, pill organizers, reminders, dose-management logistics.
- `medication_access`: pharmacy choice, discount programs, refill access, cash pricing.
- `insurance_access`: prior authorization, coverage approvals, denials, appeals, payer paperwork.
- `appointments_portals`: MyChart/patient portals, portal messages, pre-visit tasks, results access.
- `mobility_equipment`: walkers, rollators, canes, wheelchairs, DME, compression garments.
- `monitoring_supplies`: blood sugar meters, CGMs, test strips, lancets, home readings.
- `home_health_rehab`: home health, visiting nurses, PT, rehab exercises.
- `caregiving_support`: future category for respite, memory-care supports, caregiver coordination, and senior-care services.

Keep categories broad. The goal is to recognize care logistics and consumer language, not to mirror ICD/SNOMED/medical-device taxonomies.

## Prompt Plug-In Points

Recommended order:

1. Connect call summaries: already started. CCKL helps interpret temporary transcripts before the transcript is deleted after approval.
2. Transcript interpretation/correction: use CCKL hints for likely terms, especially brand names and shorthand.
3. CarePrep generation: use matched terms from saved Notes/CarePrep context to better prepare appointment questions and reminders.
4. Health Topic recognition: use CCKL as a bridge from consumer terms to broad Health Focus topics without adding new saved facts.
5. Import/note intake interpretation: use CCKL for ordinary phrases in pasted text, OCR, and manual notes.
6. Admin review: show matched terms as explanation aids for prompt review, not as user data expansion.

CCKL context should be built from the source text being processed and injected as ephemeral prompt context. It should not cause raw transcripts, extra snippets, or inferred facts to be stored.

## Shared Integration API

Use `buildConsumerCareKnowledgeContext(text, { useCase })` when wiring CCKL into a new module. It returns:

- `hasMatches`: whether any seed entries matched.
- `matchedTerms`: canonical term labels for quick diagnostics or prompt metadata.
- `matches`: structured entries with matched text and confidence.
- `promptContext`: a ready-to-inject prompt block with CCKL guardrails.
- `useCase`: the workflow label used to choose context limits and guidance.

Supported use cases:

- `transcript_interpretation`
- `call_summary`
- `user_question`
- `careprep_generation`
- `health_topic_recognition`
- `note_intake`
- `admin_review`

Use `buildConsumerCareKnowledgePromptContext()` only when a caller needs the prompt string directly.

## Storage Recommendation

Stay code-native for Phase 1. Once entries, review workflow, and prompt behavior stabilize, use existing CarePland patterns:

- Create global Admin-managed instruction/content infrastructure rather than per-user records.
- Prefer a versioned catalog table similar in spirit to Health Focus catalogs and `ai_instruction_versions`.
- Track `slug`, `canonical_term`, `aliases`, `consumer_phrases`, `category`, `care_relevance`, `interpretation_guidance`, `normalization_hints`, `summary_guidance`, `confidence_notes`, `source_urls`, `is_active`, and version metadata.
- Keep source URLs and review notes admin-facing.
- Do not store transcript matches as durable records unless there is a specific reviewed feature need; if added later, store only term slugs and source workflow metadata, not raw transcript text.

Future shared infrastructure should expose a small API such as:

- `matchConsumerCareKnowledge(text, options)`
- `buildConsumerCareKnowledgeContext(text, options)`
- `mapConsumerTermToHealthTopic(termSlug)`
- `explainConsumerCareMatch(termSlug)` for Admin review

## Seed Research Sources

Phase 1 used small, reputable public sources and avoided scraping large glossaries:

- [Medicare durable medical equipment coverage](https://www.medicare.gov/coverage/durable-medical-equipment-dme-coverage)
- [HealthCare.gov preauthorization glossary](https://www.healthcare.gov/glossary/preauthorization/)
- [MyChart features](https://www.mychart.org/)
- [CDC blood sugar monitoring](https://www.cdc.gov/diabetes/treatment/index.html)
- [GoodRx how it works](https://www.goodrx.com/how-goodrx-works)
- [Amazon Pharmacy PillPack](https://www.amazon.com/pharmacy/pillpack)
- [CVS Caremark](https://www.caremark.com/)
- [Aetna SilverScript prescription drug plans](https://www.silverscript.com/)
- [G.E.H.A](https://www.geha.com/)
- [MedlinePlus rehabilitation](https://medlineplus.gov/rehabilitation.html)
- [Medicare home health services](https://www.medicare.gov/coverage/home-health-services)
- [NHLBI lymphedema treatment](https://www.nhlbi.nih.gov/health/lymphedema/treatment)
- [Blister pack overview](https://en.wikipedia.org/wiki/Blister_pack)
- [Pill organizer overview](https://en.wikipedia.org/wiki/Pill_organizer)

## Guardrails

- CCKL never creates a diagnosis.
- CCKL never recommends treatment.
- CCKL never expands what CarePland stores.
- CCKL never preserves temporary transcripts.
- CCKL should prefer consumer language over clinical completeness.
- If a term is ambiguous, the prompt should say so and omit unsupported details.
