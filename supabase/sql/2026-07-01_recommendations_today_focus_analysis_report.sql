-- CarePland Recommendations / Today's Focus analysis report.
--
-- READ ONLY. This file is intended for Supabase SQL Editor analysis, not as a
-- migration. It does not insert, update, delete, create, or alter anything.
--
-- Optional narrowing:
--   Add filters such as `and cs.id = '<care_subject_id>'` or
--   `and cc.id = '<care_circle_id>'` in each query's base CTE when reviewing
--   one test family / Care VIP.

-- ---------------------------------------------------------------------------
-- 1. Care VIP source coverage
-- ---------------------------------------------------------------------------
-- Shows whether each Care VIP has enough source material for an initial
-- recommendation pass.

with appointment_counts as (
  select
    a.care_subject_id,
    count(*) as appointments_count,
    count(*) filter (where a.starts_at::date = current_date) as appointments_today_count,
    count(*) filter (where a.starts_at::date = current_date + interval '1 day') as appointments_tomorrow_count
  from public.appointments a
  where coalesce(a.status, '') <> 'archived'
    and coalesce(a.deleted_at, null) is null
  group by a.care_subject_id
),
note_counts as (
  select
    a.care_subject_id,
    count(*) as current_notes_count
  from public.appointment_notes an
  join public.appointments a on a.id = an.appointment_id
  where an.is_current = true
  group by a.care_subject_id
),
careprep_counts as (
  select
    a.care_subject_id,
    count(*) as current_careprep_count
  from public.careprep_guidance cg
  join public.appointments a on a.id = cg.appointment_id
  where cg.is_current = true
  group by a.care_subject_id
),
topic_counts as (
  select
    tm.care_subject_id,
    count(*) as health_focus_mentions_count,
    count(distinct tm.normalized_topic_slug) as health_focus_topics_count
  from public.topic_mentions tm
  where tm.is_active = true
  group by tm.care_subject_id
),
track_counts as (
  select
    te.care_subject_id,
    count(*) as track_events_count,
    count(*) filter (where te.occurred_at >= now() - interval '14 days') as recent_track_events_count
  from public.track_events te
  where te.event_status = 'active'
  group by te.care_subject_id
),
focus_counts as (
  select
    fi.care_subject_id,
    count(*) filter (where fi.status = 'active') as active_focus_items_count
  from public.focus_items fi
  group by fi.care_subject_id
),
recommendation_counts as (
  select
    cr.care_subject_id,
    count(*) filter (where cr.status = 'candidate') as recommendation_candidates_count,
    count(*) filter (where cr.status = 'converted_to_focus') as converted_recommendations_count
  from public.care_recommendations cr
  group by cr.care_subject_id
)
select
  cs.care_circle_id,
  cs.id as care_subject_id,
  cs.display_name as care_vip_name,
  coalesce(ac.appointments_count, 0) as appointments_count,
  coalesce(ac.appointments_today_count, 0) as appointments_today_count,
  coalesce(ac.appointments_tomorrow_count, 0) as appointments_tomorrow_count,
  coalesce(nc.current_notes_count, 0) as current_notes_count,
  coalesce(cpc.current_careprep_count, 0) as current_careprep_count,
  coalesce(tc.health_focus_mentions_count, 0) as health_focus_mentions_count,
  coalesce(tc.health_focus_topics_count, 0) as health_focus_topics_count,
  coalesce(trc.track_events_count, 0) as track_events_count,
  coalesce(trc.recent_track_events_count, 0) as recent_track_events_count,
  coalesce(fc.active_focus_items_count, 0) as active_focus_items_count,
  coalesce(rc.recommendation_candidates_count, 0) as recommendation_candidates_count,
  coalesce(rc.converted_recommendations_count, 0) as converted_recommendations_count,
  case
    when coalesce(nc.current_notes_count, 0)
       + coalesce(cpc.current_careprep_count, 0)
       + coalesce(tc.health_focus_mentions_count, 0)
       + coalesce(trc.track_events_count, 0) >= 5
      then 'good_initial_signal'
    when coalesce(nc.current_notes_count, 0)
       + coalesce(cpc.current_careprep_count, 0)
       + coalesce(tc.health_focus_mentions_count, 0)
       + coalesce(trc.track_events_count, 0) > 0
      then 'some_signal'
    else 'little_or_no_signal'
  end as recommendation_readiness
from public.care_subjects cs
left join appointment_counts ac on ac.care_subject_id = cs.id
left join note_counts nc on nc.care_subject_id = cs.id
left join careprep_counts cpc on cpc.care_subject_id = cs.id
left join topic_counts tc on tc.care_subject_id = cs.id
left join track_counts trc on trc.care_subject_id = cs.id
left join focus_counts fc on fc.care_subject_id = cs.id
left join recommendation_counts rc on rc.care_subject_id = cs.id
where coalesce(cs.is_active, true) = true
order by recommendation_readiness, cs.display_name nulls last, cs.id;

-- ---------------------------------------------------------------------------
-- 2. Recommendation-like evidence snippets
-- ---------------------------------------------------------------------------
-- Roughly mirrors the deterministic v1 recommendation sources: current notes,
-- current CarePrep, Health Focus mentions, and Track history.

with source_evidence as (
  select
    a.care_circle_id,
    a.care_subject_id,
    'appointment_note'::text as source_type,
    'appointment_notes'::text as source_table,
    an.id as source_id,
    coalesce(a.title, 'Visit note') as source_label,
    coalesce(a.starts_at, an.created_at) as occurred_at,
    0.85::numeric as confidence,
    trim(concat_ws(
      ' ',
      an.summary_short,
      an.input_text,
      an.takeaways::text,
      an.followups::text
    )) as evidence_text
  from public.appointment_notes an
  join public.appointments a on a.id = an.appointment_id
  where an.is_current = true

  union all

  select
    a.care_circle_id,
    a.care_subject_id,
    'careprep_guidance'::text as source_type,
    'careprep_guidance'::text as source_table,
    cg.id as source_id,
    coalesce(a.title, 'CarePrep') as source_label,
    coalesce(cg.generated_at, a.starts_at) as occurred_at,
    0.80::numeric as confidence,
    trim(concat_ws(
      ' ',
      cg.summary,
      cg.key_questions::text,
      cg.bring_list::text,
      cg.watchouts::text,
      cg.med_review::text,
      cg.since_last_visit::text,
      cg.next_steps::text
    )) as evidence_text
  from public.careprep_guidance cg
  join public.appointments a on a.id = cg.appointment_id
  where cg.is_current = true

  union all

  select
    tm.care_circle_id,
    tm.care_subject_id,
    'health_focus'::text as source_type,
    'topic_mentions'::text as source_table,
    tm.id as source_id,
    'Health Focus'::text as source_label,
    coalesce(tm.appointment_starts_at, tm.created_at) as occurred_at,
    coalesce(tm.confidence, 0.65)::numeric as confidence,
    trim(concat_ws(' ', tm.normalized_topic_slug, tm.source_snippet)) as evidence_text
  from public.topic_mentions tm
  where tm.is_active = true

  union all

  select
    te.care_circle_id,
    te.care_subject_id,
    'track_history'::text as source_type,
    'track_events'::text as source_table,
    te.id as source_id,
    'Track history'::text as source_label,
    te.occurred_at,
    coalesce(te.confidence, 0.60)::numeric as confidence,
    trim(concat_ws(' ', te.event_type, te.title, te.note)) as evidence_text
  from public.track_events te
  where te.event_status = 'active'
),
candidate_matches as (
  select
    se.*,
    match.candidate_key,
    match.candidate_title,
    match.completion_type,
    match.completion_event_type,
    match.matched_keyword
  from source_evidence se
  join lateral (
    values
      (
        'home_blood_pressure_monitoring',
        'Track home blood pressure readings',
        'measured_value',
        'measurement.blood_pressure',
        'blood pressure / home monitoring'
      ),
      (
        'walking_mobility_support',
        'Take a short walk',
        'simple_done',
        'activity.walking',
        'walking / mobility / balance'
      ),
      (
        'weight_or_nutrition_monitoring',
        'Record weight',
        'measured_value',
        'measurement.weight',
        'weight / nutrition / appetite'
      ),
      (
        'medication_timing_review',
        'Review medication timing notes',
        'note_required',
        'note.caregiver',
        'medication timing / medication list'
      )
  ) as match(candidate_key, candidate_title, completion_type, completion_event_type, matched_keyword)
    on (
      (match.candidate_key = 'home_blood_pressure_monitoring'
        and se.evidence_text ~* '(track home blood pressure|home bp|home blood pressure|blood pressure log|home monitoring)')
      or
      (match.candidate_key = 'walking_mobility_support'
        and se.evidence_text ~* '(walking tolerance|walking|balance|activity planning|mobility)')
      or
      (match.candidate_key = 'weight_or_nutrition_monitoring'
        and se.evidence_text ~* '(weight|nutrition|appetite)')
      or
      (match.candidate_key = 'medication_timing_review'
        and se.evidence_text ~* '(medication timing|medication list|medications?)')
    )
  where se.evidence_text <> ''
)
select
  cs.display_name as care_vip_name,
  cm.care_subject_id,
  cm.candidate_key,
  cm.candidate_title,
  cm.completion_type,
  cm.completion_event_type,
  cm.source_type,
  cm.source_table,
  cm.source_id,
  cm.source_label,
  cm.occurred_at,
  cm.confidence,
  cm.matched_keyword,
  left(cm.evidence_text, 400) as evidence_snippet
from candidate_matches cm
join public.care_subjects cs on cs.id = cm.care_subject_id
order by cs.display_name nulls last, cm.candidate_title, cm.occurred_at desc nulls last;

-- ---------------------------------------------------------------------------
-- 3. Rough recommendation candidates by Care VIP
-- ---------------------------------------------------------------------------
-- Aggregates the evidence above into candidate-level rows. This approximates
-- the app's deterministic generator for analysis; the app remains the source
-- of truth for actual creation/persistence.

with source_evidence as (
  select
    a.care_circle_id,
    a.care_subject_id,
    'appointment_note'::text as source_type,
    'appointment_notes'::text as source_table,
    an.id as source_id,
    coalesce(a.title, 'Visit note') as source_label,
    coalesce(a.starts_at, an.created_at) as occurred_at,
    0.85::numeric as confidence,
    trim(concat_ws(' ', an.summary_short, an.input_text, an.takeaways::text, an.followups::text)) as evidence_text
  from public.appointment_notes an
  join public.appointments a on a.id = an.appointment_id
  where an.is_current = true

  union all

  select
    a.care_circle_id,
    a.care_subject_id,
    'careprep_guidance'::text as source_type,
    'careprep_guidance'::text as source_table,
    cg.id as source_id,
    coalesce(a.title, 'CarePrep') as source_label,
    coalesce(cg.generated_at, a.starts_at) as occurred_at,
    0.80::numeric as confidence,
    trim(concat_ws(' ', cg.summary, cg.key_questions::text, cg.bring_list::text, cg.watchouts::text, cg.med_review::text, cg.since_last_visit::text, cg.next_steps::text)) as evidence_text
  from public.careprep_guidance cg
  join public.appointments a on a.id = cg.appointment_id
  where cg.is_current = true

  union all

  select
    tm.care_circle_id,
    tm.care_subject_id,
    'health_focus'::text as source_type,
    'topic_mentions'::text as source_table,
    tm.id as source_id,
    'Health Focus'::text as source_label,
    coalesce(tm.appointment_starts_at, tm.created_at) as occurred_at,
    coalesce(tm.confidence, 0.65)::numeric as confidence,
    trim(concat_ws(' ', tm.normalized_topic_slug, tm.source_snippet)) as evidence_text
  from public.topic_mentions tm
  where tm.is_active = true

  union all

  select
    te.care_circle_id,
    te.care_subject_id,
    'track_history'::text as source_type,
    'track_events'::text as source_table,
    te.id as source_id,
    'Track history'::text as source_label,
    te.occurred_at,
    coalesce(te.confidence, 0.60)::numeric as confidence,
    trim(concat_ws(' ', te.event_type, te.title, te.note)) as evidence_text
  from public.track_events te
  where te.event_status = 'active'
),
candidate_matches as (
  select
    se.*,
    match.candidate_key,
    match.candidate_title,
    match.completion_type,
    match.completion_event_type
  from source_evidence se
  join lateral (
    values
      ('home_blood_pressure_monitoring', 'Track home blood pressure readings', 'measured_value', 'measurement.blood_pressure'),
      ('walking_mobility_support', 'Take a short walk', 'simple_done', 'activity.walking'),
      ('weight_or_nutrition_monitoring', 'Record weight', 'measured_value', 'measurement.weight'),
      ('medication_timing_review', 'Review medication timing notes', 'note_required', 'note.caregiver')
  ) as match(candidate_key, candidate_title, completion_type, completion_event_type)
    on (
      (match.candidate_key = 'home_blood_pressure_monitoring'
        and se.evidence_text ~* '(track home blood pressure|home bp|home blood pressure|blood pressure log|home monitoring)')
      or
      (match.candidate_key = 'walking_mobility_support'
        and se.evidence_text ~* '(walking tolerance|walking|balance|activity planning|mobility)')
      or
      (match.candidate_key = 'weight_or_nutrition_monitoring'
        and se.evidence_text ~* '(weight|nutrition|appetite)')
      or
      (match.candidate_key = 'medication_timing_review'
        and se.evidence_text ~* '(medication timing|medication list|medications?)')
    )
  where se.evidence_text <> ''
),
aggregated as (
  select
    cm.care_circle_id,
    cm.care_subject_id,
    cm.candidate_key,
    cm.candidate_title,
    cm.completion_type,
    cm.completion_event_type,
    count(*) as evidence_count,
    count(distinct concat_ws(':', cm.source_type, cm.source_table, cm.source_id::text)) as unique_source_count,
    array_agg(distinct cm.source_type order by cm.source_type) as source_types,
    avg(cm.confidence) as average_confidence,
    max(cm.occurred_at) as latest_evidence_at,
    bool_or(cm.evidence_text ~* '(strongly|important|priority)') as has_strong_importance_language,
    bool_or(cm.source_type in ('appointment_note', 'careprep_guidance', 'provider_recommendation')) as provider_or_careprep_backed,
    jsonb_agg(
      jsonb_build_object(
        'sourceType', cm.source_type,
        'sourceTable', cm.source_table,
        'sourceId', cm.source_id,
        'sourceLabel', cm.source_label,
        'occurredAt', cm.occurred_at,
        'snippet', left(cm.evidence_text, 240)
      )
      order by cm.occurred_at desc nulls last
    ) as evidence
  from candidate_matches cm
  group by
    cm.care_circle_id,
    cm.care_subject_id,
    cm.candidate_key,
    cm.candidate_title,
    cm.completion_type,
    cm.completion_event_type
)
select
  cs.display_name as care_vip_name,
  ag.care_subject_id,
  ag.candidate_key,
  ag.candidate_title,
  ag.completion_type,
  ag.completion_event_type,
  case
    when ag.has_strong_importance_language then 'strong'
    when ag.provider_or_careprep_backed or ag.unique_source_count >= 3 then 'high'
    when ag.average_confidence < 0.45 then 'low'
    else 'normal'
  end as rough_priority,
  round(
    least(
      1,
      ag.average_confidence + least(0.15, greatest(0, ag.unique_source_count - 1) * 0.05)
    ),
    3
  ) as rough_confidence,
  ag.evidence_count,
  ag.unique_source_count,
  ag.source_types,
  ag.latest_evidence_at,
  jsonb_build_object(
    'priorityRationale',
    case
      when ag.has_strong_importance_language then 'Explicit strong-importance language was found.'
      when ag.provider_or_careprep_backed then 'Provider note or CarePrep evidence supports the candidate.'
      when ag.unique_source_count >= 3 then 'Three or more independent sources support the candidate.'
      when ag.average_confidence < 0.45 then 'One or more sources are low confidence.'
      else 'Supported candidate without a strong/high/low modifier.'
    end,
    'confidenceRationale',
    'Average source confidence plus a small boost for independent sources, capped at 1.0.'
  ) as analysis_rationale,
  ag.evidence
from aggregated ag
join public.care_subjects cs on cs.id = ag.care_subject_id
order by
  cs.display_name nulls last,
  case
    when ag.has_strong_importance_language then 4
    when ag.provider_or_careprep_backed or ag.unique_source_count >= 3 then 3
    when ag.average_confidence < 0.45 then 1
    else 2
  end desc,
  rough_confidence desc,
  ag.candidate_title;

-- ---------------------------------------------------------------------------
-- 4. Stored recommendations and evidence
-- ---------------------------------------------------------------------------
-- Shows what has already been generated/approved/converted by the backend.

select
  cs.display_name as care_vip_name,
  cr.care_subject_id,
  cr.id as recommendation_id,
  cr.status,
  cr.priority,
  cr.confidence,
  cr.title,
  cr.reason,
  cr.dedupe_key,
  cr.source_type,
  cr.created_at,
  cr.updated_at,
  cr.converted_focus_item_id,
  cr.structured_payload -> 'recommendationTrace' as recommendation_trace,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'sourceType', cre.source_type,
        'sourceTable', cre.source_table,
        'sourceId', cre.source_id,
        'sourceLabel', cre.source_label,
        'occurredAt', cre.occurred_at,
        'evidenceText', cre.evidence_text
      )
      order by cre.occurred_at desc nulls last
    ) filter (where cre.id is not null),
    '[]'::jsonb
  ) as evidence
from public.care_recommendations cr
join public.care_subjects cs on cs.id = cr.care_subject_id
left join public.care_recommendation_evidence cre
  on cre.recommendation_id = cr.id
group by
  cs.display_name,
  cr.care_subject_id,
  cr.id
order by cs.display_name nulls last, cr.status, cr.priority, cr.created_at desc;

-- ---------------------------------------------------------------------------
-- 5. Existing Focus Items with rough Today's Focus ranking
-- ---------------------------------------------------------------------------
-- Approximates the TypeScript Today’s Focus ranking policy in SQL so you can
-- inspect what would likely make the top 3. The app endpoint remains the source
-- of truth because it applies the full TypeScript policy.

with completed_today as (
  select distinct te.focus_item_id
  from public.track_events te
  where te.focus_item_id is not null
    and te.event_status = 'active'
    and te.event_type <> 'medication.skipped'
    and te.occurred_at >= current_date
    and te.occurred_at < current_date + interval '1 day'
),
skipped_counts as (
  select
    te.focus_item_id,
    count(*) as skipped_count
  from public.track_events te
  where te.focus_item_id is not null
    and te.event_status = 'active'
    and te.event_type = 'medication.skipped'
    and te.occurred_at >= now() - interval '14 days'
  group by te.focus_item_id
),
active_focus as (
  select
    fi.*,
    case
      when fi.metadata ->> 'source' ilike '%user%'
        or fi.metadata ->> 'goalSource' = 'user'
        or fi.metadata ->> 'createdByRole' = 'user'
        then 'user_today_goal'
      when fi.metadata ->> 'source' ilike '%caregiver%'
        or fi.metadata ->> 'goalSource' = 'caregiver'
        or fi.metadata ->> 'createdByRole' = 'caregiver'
        then 'caregiver_goal'
      when fi.focus_type like '%appointment%'
        and left(coalesce(fi.metadata ->> 'appointmentDate', ''), 10) = current_date::text
        then 'appointment_today'
      when fi.completion_type = 'medication'
        or coalesce(fi.completion_event_type, '') like 'medication.%'
        then 'medication_reminder'
      when fi.focus_type like '%appointment%'
        and left(coalesce(fi.metadata ->> 'appointmentDate', ''), 10) = (current_date + interval '1 day')::date::text
        then 'appointment_tomorrow_prep'
      when fi.metadata ->> 'source' ilike '%care_recommendation%'
        or fi.metadata ? 'recommendationId'
        then 'ai_recommendation'
      when fi.importance_score <= 25
        or fi.metadata ->> 'priority' = 'low'
        then 'low_priority_suggestion'
      else 'routine_habit'
    end as source_category
  from public.focus_items fi
  where fi.status = 'active'
    and (fi.active_start_date is null or fi.active_start_date <= current_date)
    and (fi.active_end_date is null or fi.active_end_date >= current_date)
),
scored as (
  select
    af.*,
    case af.source_category
      when 'user_today_goal' then 100
      when 'caregiver_goal' then 95
      when 'appointment_today' then 90
      when 'medication_reminder' then 90
      when 'appointment_tomorrow_prep' then 80
      when 'ai_recommendation' then 70
      when 'routine_habit' then 50
      when 'low_priority_suggestion' then 20
      else 50
    end as base_weight,
    case
      when af.metadata ->> 'overdue' = 'true'
        or af.schedule ->> 'overdue' = 'true'
        or left(coalesce(af.metadata ->> 'dueDate', af.schedule ->> 'dueDate', ''), 10) < current_date::text
        then 20
      else 0
    end as overdue_modifier,
    case
      when coalesce(sc.skipped_count, 0) >= 2
        or af.metadata ->> 'repeatedlySkipped' = 'true'
        then 15
      else 0
    end as repeatedly_skipped_modifier,
    case
      when af.metadata -> 'recommendationTrace' -> 'sourceTypeCounts' ? 'appointment_note'
        or af.metadata -> 'recommendationTrace' -> 'sourceTypeCounts' ? 'careprep_guidance'
        or af.metadata ->> 'providerRecommended' = 'true'
        then 25
      else 0
    end as provider_recommended_modifier,
    case
      when af.active_end_date = current_date
        or left(coalesce(af.metadata ->> 'expiresAt', ''), 10) = current_date::text
        then 15
      else 0
    end as expires_today_modifier,
    ct.focus_item_id is not null as already_completed_today,
    coalesce(sc.skipped_count, 0) as recent_skipped_count
  from active_focus af
  left join completed_today ct on ct.focus_item_id = af.id
  left join skipped_counts sc on sc.focus_item_id = af.id
)
select
  cs.display_name as care_vip_name,
  s.care_subject_id,
  s.id as focus_item_id,
  s.title,
  s.focus_type,
  s.completion_type,
  s.completion_event_type,
  s.source_category,
  s.base_weight,
  s.overdue_modifier,
  s.repeatedly_skipped_modifier,
  s.provider_recommended_modifier,
  s.expires_today_modifier,
  least(
    150,
    greatest(
      0,
      s.base_weight
      + s.overdue_modifier
      + s.repeatedly_skipped_modifier
      + s.provider_recommended_modifier
      + s.expires_today_modifier
    )
  ) as rough_today_focus_score,
  s.already_completed_today,
  s.recent_skipped_count,
  s.sort_order,
  s.created_at,
  s.metadata -> 'focusRankingDecision' as prior_conversion_ranking_decision,
  s.metadata -> 'recommendationTrace' as recommendation_trace
from scored s
join public.care_subjects cs on cs.id = s.care_subject_id
where s.already_completed_today = false
order by
  cs.display_name nulls last,
  rough_today_focus_score desc,
  s.sort_order asc,
  s.created_at desc;

-- ---------------------------------------------------------------------------
-- 6. Top 3 rough Today's Focus items per Care VIP
-- ---------------------------------------------------------------------------
-- Same rough scoring as section 5, reduced to the likely top 3 per person.

with completed_today as (
  select distinct te.focus_item_id
  from public.track_events te
  where te.focus_item_id is not null
    and te.event_status = 'active'
    and te.event_type <> 'medication.skipped'
    and te.occurred_at >= current_date
    and te.occurred_at < current_date + interval '1 day'
),
skipped_counts as (
  select
    te.focus_item_id,
    count(*) as skipped_count
  from public.track_events te
  where te.focus_item_id is not null
    and te.event_status = 'active'
    and te.event_type = 'medication.skipped'
    and te.occurred_at >= now() - interval '14 days'
  group by te.focus_item_id
),
ranked as (
  select
    cs.display_name as care_vip_name,
    fi.care_subject_id,
    fi.id as focus_item_id,
    fi.title,
    fi.completion_type,
    fi.completion_event_type,
    case
      when fi.metadata ->> 'source' ilike '%user%' then 'user_today_goal'
      when fi.metadata ->> 'source' ilike '%caregiver%' then 'caregiver_goal'
      when fi.focus_type like '%appointment%' and left(coalesce(fi.metadata ->> 'appointmentDate', ''), 10) = current_date::text then 'appointment_today'
      when fi.completion_type = 'medication' or coalesce(fi.completion_event_type, '') like 'medication.%' then 'medication_reminder'
      when fi.focus_type like '%appointment%' and left(coalesce(fi.metadata ->> 'appointmentDate', ''), 10) = (current_date + interval '1 day')::date::text then 'appointment_tomorrow_prep'
      when fi.metadata ->> 'source' ilike '%care_recommendation%' or fi.metadata ? 'recommendationId' then 'ai_recommendation'
      when fi.importance_score <= 25 or fi.metadata ->> 'priority' = 'low' then 'low_priority_suggestion'
      else 'routine_habit'
    end as source_category,
    (
      case
        when fi.metadata ->> 'source' ilike '%user%' then 100
        when fi.metadata ->> 'source' ilike '%caregiver%' then 95
        when fi.focus_type like '%appointment%' and left(coalesce(fi.metadata ->> 'appointmentDate', ''), 10) = current_date::text then 90
        when fi.completion_type = 'medication' or coalesce(fi.completion_event_type, '') like 'medication.%' then 90
        when fi.focus_type like '%appointment%' and left(coalesce(fi.metadata ->> 'appointmentDate', ''), 10) = (current_date + interval '1 day')::date::text then 80
        when fi.metadata ->> 'source' ilike '%care_recommendation%' or fi.metadata ? 'recommendationId' then 70
        when fi.importance_score <= 25 or fi.metadata ->> 'priority' = 'low' then 20
        else 50
      end
      + case when fi.metadata ->> 'overdue' = 'true' or fi.schedule ->> 'overdue' = 'true' then 20 else 0 end
      + case when coalesce(sc.skipped_count, 0) >= 2 or fi.metadata ->> 'repeatedlySkipped' = 'true' then 15 else 0 end
      + case when fi.metadata -> 'recommendationTrace' -> 'sourceTypeCounts' ? 'appointment_note'
              or fi.metadata -> 'recommendationTrace' -> 'sourceTypeCounts' ? 'careprep_guidance'
              or fi.metadata ->> 'providerRecommended' = 'true' then 25 else 0 end
      + case when fi.active_end_date = current_date or left(coalesce(fi.metadata ->> 'expiresAt', ''), 10) = current_date::text then 15 else 0 end
    ) as rough_today_focus_score,
    row_number() over (
      partition by fi.care_subject_id
      order by
        (
          case
            when fi.metadata ->> 'source' ilike '%user%' then 100
            when fi.metadata ->> 'source' ilike '%caregiver%' then 95
            when fi.focus_type like '%appointment%' and left(coalesce(fi.metadata ->> 'appointmentDate', ''), 10) = current_date::text then 90
            when fi.completion_type = 'medication' or coalesce(fi.completion_event_type, '') like 'medication.%' then 90
            when fi.focus_type like '%appointment%' and left(coalesce(fi.metadata ->> 'appointmentDate', ''), 10) = (current_date + interval '1 day')::date::text then 80
            when fi.metadata ->> 'source' ilike '%care_recommendation%' or fi.metadata ? 'recommendationId' then 70
            when fi.importance_score <= 25 or fi.metadata ->> 'priority' = 'low' then 20
            else 50
          end
          + case when fi.metadata ->> 'overdue' = 'true' or fi.schedule ->> 'overdue' = 'true' then 20 else 0 end
          + case when coalesce(sc.skipped_count, 0) >= 2 or fi.metadata ->> 'repeatedlySkipped' = 'true' then 15 else 0 end
          + case when fi.metadata -> 'recommendationTrace' -> 'sourceTypeCounts' ? 'appointment_note'
                  or fi.metadata -> 'recommendationTrace' -> 'sourceTypeCounts' ? 'careprep_guidance'
                  or fi.metadata ->> 'providerRecommended' = 'true' then 25 else 0 end
          + case when fi.active_end_date = current_date or left(coalesce(fi.metadata ->> 'expiresAt', ''), 10) = current_date::text then 15 else 0 end
        ) desc,
        fi.sort_order asc,
        fi.created_at desc
    ) as person_rank
  from public.focus_items fi
  join public.care_subjects cs on cs.id = fi.care_subject_id
  left join skipped_counts sc on sc.focus_item_id = fi.id
  left join completed_today ct on ct.focus_item_id = fi.id
  where fi.status = 'active'
    and (fi.active_start_date is null or fi.active_start_date <= current_date)
    and (fi.active_end_date is null or fi.active_end_date >= current_date)
    and ct.focus_item_id is null
)
select *
from ranked
where person_rank <= 3
order by care_vip_name nulls last, person_rank;
