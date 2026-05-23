create or replace function public.get_admin_careprep_generation_outliers(
  p_lookback_hours integer default 24,
  p_window_generation_threshold integer default 20,
  p_window_refresh_threshold integer default 10,
  p_weekly_generation_threshold integer default 75
)
returns table (
  care_circle_id uuid,
  user_id uuid,
  display_name text,
  email text,
  generated_count_window bigint,
  appointment_count_window bigint,
  refresh_like_count_window bigint,
  generated_count_7d bigint,
  appointment_count_7d bigint,
  refresh_like_count_7d bigint,
  latest_generated_at timestamptz,
  severity text,
  reason text
)
language sql
security definer
set search_path = public
as $$
  with admin_check as (
    select public.assert_current_user_is_admin()
  ),
  thresholds as (
    select
      make_interval(hours => greatest(coalesce(p_lookback_hours, 24), 1)) as window_interval,
      greatest(coalesce(p_window_generation_threshold, 20), 1)::bigint as window_generation_threshold,
      greatest(coalesce(p_window_refresh_threshold, 10), 1)::bigint as window_refresh_threshold,
      greatest(coalesce(p_weekly_generation_threshold, 75), 1)::bigint as weekly_generation_threshold
  ),
  recent as (
    select
      cg.care_circle_id,
      cg.user_id,
      cg.appointment_id,
      cg.generated_at
    from public.careprep_guidance cg
    cross join thresholds t
    where cg.generated_at >= now() - interval '7 days'
  ),
  rolled_up as (
    select
      r.care_circle_id,
      r.user_id,
      count(*) filter (where r.generated_at >= now() - t.window_interval) as generated_count_window,
      count(distinct r.appointment_id) filter (where r.generated_at >= now() - t.window_interval) as appointment_count_window,
      greatest(
        count(*) filter (where r.generated_at >= now() - t.window_interval) -
        count(distinct r.appointment_id) filter (where r.generated_at >= now() - t.window_interval),
        0
      ) as refresh_like_count_window,
      count(*) as generated_count_7d,
      count(distinct r.appointment_id) as appointment_count_7d,
      greatest(count(*) - count(distinct r.appointment_id), 0) as refresh_like_count_7d,
      max(r.generated_at) as latest_generated_at,
      max(t.window_generation_threshold) as window_generation_threshold,
      max(t.window_refresh_threshold) as window_refresh_threshold,
      max(t.weekly_generation_threshold) as weekly_generation_threshold
    from recent r
    cross join thresholds t
    group by r.care_circle_id, r.user_id
  ),
  flagged as (
    select
      ru.*,
      case
        when ru.generated_count_window >= ru.window_generation_threshold * 2
          or ru.refresh_like_count_window >= ru.window_refresh_threshold * 2
          or ru.generated_count_7d >= ru.weekly_generation_threshold * 2
          then 'critical'
        when ru.generated_count_window >= ru.window_generation_threshold
          or ru.refresh_like_count_window >= ru.window_refresh_threshold
          or ru.generated_count_7d >= ru.weekly_generation_threshold
          then 'watch'
        else 'normal'
      end as severity
    from rolled_up ru
  )
  select
    f.care_circle_id,
    f.user_id,
    coalesce(nullif(trim(p.display_name), ''), 'Unknown user') as display_name,
    nullif(trim(p.email), '') as email,
    f.generated_count_window,
    f.appointment_count_window,
    f.refresh_like_count_window,
    f.generated_count_7d,
    f.appointment_count_7d,
    f.refresh_like_count_7d,
    f.latest_generated_at,
    f.severity,
    concat_ws(
      '; ',
      case
        when f.generated_count_window >= f.window_generation_threshold
          then 'high CarePrep generation volume in the short window'
      end,
      case
        when f.refresh_like_count_window >= f.window_refresh_threshold
          then 'many repeat generations across the same appointment set'
      end,
      case
        when f.generated_count_7d >= f.weekly_generation_threshold
          then 'high CarePrep generation volume over 7 days'
      end
    ) as reason
  from flagged f
  cross join admin_check
  left join public.profiles p on p.id = f.user_id
  where f.severity <> 'normal'
  order by
    case f.severity when 'critical' then 0 else 1 end,
    f.generated_count_window desc,
    f.refresh_like_count_window desc,
    f.generated_count_7d desc;
$$;

grant execute on function public.get_admin_careprep_generation_outliers(integer, integer, integer, integer)
  to authenticated;
