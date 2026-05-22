create or replace function public.delete_admin_integration_error_window(
  p_window_grain text,
  p_window_start timestamptz,
  p_integration_key text,
  p_error_key text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  perform public.assert_current_user_is_admin();

  if p_window_grain not in ('day', 'minute') then
    raise exception 'Invalid integration error window grain: %', p_window_grain;
  end if;

  delete from public.integration_error_events
  where date_trunc(p_window_grain, occurred_at) = p_window_start
    and integration_key = lower(trim(p_integration_key))
    and error_key = lower(trim(p_error_key));

  get diagnostics deleted_count = row_count;

  return deleted_count;
end;
$$;

grant execute on function public.delete_admin_integration_error_window(
  text,
  timestamptz,
  text,
  text
) to authenticated;
