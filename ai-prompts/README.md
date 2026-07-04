# CarePland AI Prompt Exports

These files are source-controlled exports of the app's current AI prompt surfaces.
They are references for review, editing, seeding, and future modularization.

The app does not load these files at runtime yet. Current runtime behavior is:

- `careprep_generation`: loads a current dynamic instruction version from Supabase and requires one to exist.
- `bulk_appointment_intake`: loads a dynamic instruction version when present; otherwise uses the fallback system prompt in code.
- `note_intake_interpretation`: loads a dynamic instruction version when present; otherwise uses the fallback system prompt in code.
- `support_assistant`: loads a dynamic instruction version when present; otherwise uses the fallback system prompt in code.
- `ocr_image_text_extraction`: uses a hardcoded user prompt and image inputs.
- `support_assistant_analysis`: uses hardcoded system and user prompt composition for admin QA analysis.
- `consumer_care_knowledge_layer`: proposed shared normalization prompt; not yet wired as a runtime AI route.

Recommended file meanings:

- `system.json`: system/developer instructions for the model.
- `user-template.json`: reusable user prompt template or runtime composition notes.
- `output-schema.json`: expected structured output schema, when used.
- `parameters.txt`: model, temperature, route, runtime source, and operational notes.
