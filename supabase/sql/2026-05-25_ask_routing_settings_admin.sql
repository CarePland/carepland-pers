create or replace function public.update_ask_routing_settings(
  p_auto_route_enabled boolean,
  p_auto_create_min_confidence numeric,
  p_clarify_default_max_turns integer,
  p_clarify_absolute_max_turns integer
)
returns public.ask_routing_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_settings public.ask_routing_settings%rowtype;
  cleaned_auto_create_min_confidence numeric;
  cleaned_clarify_default_max_turns integer;
  cleaned_clarify_absolute_max_turns integer;
begin
  perform public.assert_current_user_is_admin();

  cleaned_auto_create_min_confidence := least(
    1,
    greatest(0, coalesce(p_auto_create_min_confidence, 0.9))
  );
  cleaned_clarify_default_max_turns := greatest(
    0,
    coalesce(p_clarify_default_max_turns, 3)
  );
  cleaned_clarify_absolute_max_turns := greatest(
    cleaned_clarify_default_max_turns,
    coalesce(p_clarify_absolute_max_turns, 5)
  );

  insert into public.ask_routing_settings (
    settings_key,
    auto_route_enabled,
    auto_create_min_confidence,
    clarify_default_max_turns,
    clarify_absolute_max_turns,
    updated_by_user_id,
    updated_at
  )
  values (
    'default',
    coalesce(p_auto_route_enabled, false),
    cleaned_auto_create_min_confidence,
    cleaned_clarify_default_max_turns,
    cleaned_clarify_absolute_max_turns,
    auth.uid(),
    now()
  )
  on conflict (settings_key)
  do update set
    auto_route_enabled = excluded.auto_route_enabled,
    auto_create_min_confidence = excluded.auto_create_min_confidence,
    clarify_default_max_turns = excluded.clarify_default_max_turns,
    clarify_absolute_max_turns = excluded.clarify_absolute_max_turns,
    updated_by_user_id = auth.uid(),
    updated_at = now()
  returning * into updated_settings;

  return updated_settings;
end;
$$;

grant execute on function public.update_ask_routing_settings(
  boolean,
  numeric,
  integer,
  integer
) to authenticated;
