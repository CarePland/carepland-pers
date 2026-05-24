-- Admin utility: remove only the demo records created by
-- 2026-05-23_seed_admin_attention_demo.sql.
--
-- Safe to re-run. This does not remove real Product Mgmt areas, real support
-- tickets, real errors, real assistant reviews, or real Agent Knowledge rows.
--
-- Expected effect:
-- - Deletes rows explicitly marked as Admin attention demo records.
-- - Marks the demo-related Admin scopes viewed for existing admins so demo
--   breadcrumb lights turn off.
-- - Real unresolved/new/follow-up records can still keep a tab lit.

do $$
declare
  v_deleted_tickets integer := 0;
  v_deleted_errors integer := 0;
  v_deleted_interactions integer := 0;
  v_deleted_proposals integer := 0;
  v_deleted_product_items integer := 0;
  v_updated_view_states integer := 0;
begin
  if to_regclass('public.support_tickets') is not null then
    with deleted as (
      delete from public.support_tickets
      where context ->> 'admin_attention_demo' = 'true'
      returning id
    )
    select count(*) into v_deleted_tickets
    from deleted;
  end if;

  if to_regclass('public.integration_error_events') is not null then
    with deleted as (
      delete from public.integration_error_events
      where context ->> 'admin_attention_demo' = 'true'
      returning id
    )
    select count(*) into v_deleted_errors
    from deleted;
  end if;

  if to_regclass('public.support_assistant_interactions') is not null then
    with deleted as (
      delete from public.support_assistant_interactions
      where context ->> 'admin_attention_demo' = 'true'
      returning id
    )
    select count(*) into v_deleted_interactions
    from deleted;
  end if;

  if to_regclass('public.agent_knowledge_proposals') is not null then
    with deleted as (
      delete from public.agent_knowledge_proposals
      where title like '[Attention demo]%'
         or summary like 'Attention demo:%'
      returning id
    )
    select count(*) into v_deleted_proposals
    from deleted;
  end if;

  if to_regclass('public.product_mgmt_items') is not null then
    with deleted as (
      delete from public.product_mgmt_items
      where title like '[Attention demo]%'
      returning id
    )
    select count(*) into v_deleted_product_items
    from deleted;
  end if;

  if to_regclass('public.admin_view_states') is not null then
    update public.admin_view_states avs
    set last_viewed_at = now(),
        updated_at = now()
    where exists (
        select 1
        from public.profiles p
        where p.id = avs.admin_user_id
          and coalesce(p.is_admin, false) = true
      )
      and (
        (avs.scope_type = 'admin_tab' and avs.scope_key in ('tickets', 'errors', 'assistantReview', 'product', 'ai'))
        or (avs.scope_type = 'ai_admin_tab' and avs.scope_key in ('proposals'))
        or (avs.scope_type = 'product_area' and avs.scope_key in ('bug', 'ai_qa', 'wishlist', 'admin_ops'))
      );

    get diagnostics v_updated_view_states = row_count;
  end if;

  raise notice 'Removed Admin attention demo records. Tickets: %, errors: %, assistant reviews: %, proposals: %, product items: %, view states refreshed: %.',
    v_deleted_tickets,
    v_deleted_errors,
    v_deleted_interactions,
    v_deleted_proposals,
    v_deleted_product_items,
    v_updated_view_states;
end;
$$;
