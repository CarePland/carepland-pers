-- Demo utility: seed clearly labeled Admin attention records so the red/yellow
-- breadcrumb indicators can be reviewed across top tabs and nested menus.
--
-- Safe to re-run. It removes prior records marked with
-- context->>'admin_attention_demo' = 'true' before inserting fresh demo rows.
--
-- Expected effect for the first admin user:
-- - Tickets: red, with a new ticket needing follow-up.
-- - Errors: yellow if no newer real errors exist.
-- - Assistant Review: yellow if no newer real assistant interactions exist.
-- - AI > Proposals: yellow if no newer proposals exist.
-- - Product Mgmt: red; Bugs and Admin / Ops lanes should be yellow; AI / QA and Wishlist lanes should be red.

do $$
<<admin_attention_demo>>
declare
  v_admin_user_id uuid;
  v_target_user_id uuid;
  v_target_care_circle_id uuid;
  v_ticket_id uuid;
  v_product_area_id uuid;
  v_product_item_id uuid;
  v_proposal_id uuid;
begin
  select p.id
    into v_admin_user_id
  from public.profiles p
  where coalesce(p.is_admin, false) = true
  order by p.created_at asc
  limit 1;

  if v_admin_user_id is null then
    raise exception 'No admin profile found. Seed an admin user before running this demo utility.';
  end if;

  select p.id
    into v_target_user_id
  from public.profiles p
  where p.id <> v_admin_user_id
  order by p.created_at desc
  limit 1;

  v_target_user_id := coalesce(v_target_user_id, v_admin_user_id);

  if to_regclass('public.care_circle_memberships') is not null then
    select ccm.care_circle_id
      into v_target_care_circle_id
    from public.care_circle_memberships ccm
    where ccm.user_id = v_target_user_id
      and ccm.status = 'active'
    order by ccm.created_at asc
    limit 1;
  end if;

  delete from public.admin_view_states
  where admin_user_id = v_admin_user_id
    and (
      (scope_type = 'admin_tab' and scope_key in ('tickets', 'errors', 'assistantReview', 'product', 'ai'))
      or (scope_type = 'ai_admin_tab' and scope_key in ('proposals'))
      or (scope_type = 'product_area' and scope_key in ('bug', 'ai_qa', 'wishlist', 'admin_ops'))
    );

  insert into public.admin_view_states (
    admin_user_id,
    scope_type,
    scope_key,
    last_viewed_at,
    updated_at
  )
  values
    (v_admin_user_id, 'admin_tab', 'tickets', now() - interval '1 hour', now()),
    (v_admin_user_id, 'admin_tab', 'errors', now() - interval '1 hour', now()),
    (v_admin_user_id, 'admin_tab', 'assistantReview', now() - interval '1 hour', now()),
    (v_admin_user_id, 'admin_tab', 'product', now() - interval '1 hour', now()),
    (v_admin_user_id, 'admin_tab', 'ai', now() - interval '1 hour', now()),
    (v_admin_user_id, 'ai_admin_tab', 'proposals', now() - interval '1 hour', now()),
    (v_admin_user_id, 'product_area', 'bug', now() - interval '1 hour', now()),
    (v_admin_user_id, 'product_area', 'ai_qa', now() - interval '1 hour', now()),
    (v_admin_user_id, 'product_area', 'wishlist', now() - interval '1 hour', now()),
    (v_admin_user_id, 'product_area', 'admin_ops', now() - interval '1 hour', now())
  on conflict (admin_user_id, scope_type, scope_key)
  do update
    set last_viewed_at = excluded.last_viewed_at,
        updated_at = now();

  if to_regclass('public.support_tickets') is not null then
    delete from public.support_tickets
    where context ->> 'admin_attention_demo' = 'true';

    insert into public.support_tickets (
      user_id,
      care_circle_id,
      subject,
      status,
      priority,
      category,
      source,
      current_page,
      context,
      needs_admin_followup,
      user_has_unread_update,
      latest_user_message_at,
      latest_admin_message_at,
      created_at,
      updated_at
    )
    values (
      v_target_user_id,
      v_target_care_circle_id,
      '[Attention demo] New ticket breadcrumb',
      'open',
      'high',
      'admin_attention_demo',
      'demo_seed',
      'admin',
      jsonb_build_object('admin_attention_demo', true, 'demo_label', 'new ticket breadcrumb'),
      true,
      false,
      now() - interval '5 minutes',
      null,
      now() - interval '6 minutes',
      now() - interval '5 minutes'
    )
    returning id into v_ticket_id;

    if to_regclass('public.support_ticket_messages') is not null then
      insert into public.support_ticket_messages (
        ticket_id,
        author_user_id,
        author_role,
        message_body,
        created_at
      )
      values (
        v_ticket_id,
        v_target_user_id,
        'user',
        'Attention demo: this ticket should make Admin > Tickets red and show a red item in the ticket list.',
        now() - interval '5 minutes'
      );
    end if;
  end if;

  if to_regclass('public.integration_error_events') is not null then
    delete from public.integration_error_events
    where context ->> 'admin_attention_demo' = 'true';

    insert into public.integration_error_events (
      integration_key,
      error_key,
      error_message,
      user_id,
      attempted_call_count,
      context,
      occurred_at
    )
    values (
      'admin_attention_demo',
      'followup_only',
      'Attention demo: older integration error should show yellow follow-up when no newer errors exist.',
      v_target_user_id,
      12,
      jsonb_build_object('admin_attention_demo', true, 'demo_label', 'yellow error breadcrumb'),
      now() - interval '2 hours'
    );
  end if;

  if to_regclass('public.support_assistant_interactions') is not null then
    delete from public.support_assistant_interactions
    where context ->> 'admin_attention_demo' = 'true';

    insert into public.support_assistant_interactions (
      user_id,
      care_circle_id,
      question_subject,
      question_body,
      assistant_answer,
      suggested_next_step,
      confidence,
      escalation_recommended,
      escalation_reason,
      category,
      priority,
      outcome,
      user_feedback,
      current_page,
      context,
      model,
      created_at,
      updated_at
    )
    values (
      v_target_user_id,
      v_target_care_circle_id,
      '[Attention demo] Assistant review follow-up',
      'Can I use this app for emergency medical advice?',
      'CarePland helps organize appointment information, but it cannot help with emergencies or medical advice.',
      'Contact emergency services or your clinician for urgent care needs.',
      0.42,
      true,
      'Medical-safety boundary should be reviewed.',
      'safety',
      'high',
      'escalated',
      'Attention demo: review this assistant answer.',
      'support',
      jsonb_build_object('admin_attention_demo', true, 'demo_label', 'yellow assistant review breadcrumb'),
      'demo-model',
      now() - interval '2 hours',
      now() - interval '2 hours'
    );
  end if;

  if to_regclass('public.agent_knowledge_proposals') is not null then
    delete from public.agent_knowledge_proposals
    where summary like 'Attention demo:%';

    insert into public.agent_knowledge_proposals (
      title,
      summary,
      source_type,
      status,
      proposed_by_user_id,
      created_at,
      updated_at
    )
    values (
      '[Attention demo] Proposal follow-up breadcrumb',
      'Attention demo: older Agent Knowledge proposal should show yellow follow-up when no newer proposal exists.',
      'manual',
      'needs_review',
      v_admin_user_id,
      now() - interval '2 hours',
      now() - interval '2 hours'
    )
    returning id into v_proposal_id;

    if to_regclass('public.agent_knowledge_proposal_items') is not null then
      insert into public.agent_knowledge_proposal_items (
        proposal_id,
        content_key,
        content_label,
        original_body,
        ai_proposed_body,
        justification,
        risk_category,
        confidence,
        review_status,
        created_at,
        updated_at
      )
      values (
        v_proposal_id,
        'support_agent_known_limitations',
        'Known limitations',
        'Attention demo original limitation text.',
        'Attention demo proposed limitation text.',
        'Demo item so the AI > Proposals nested attention state can be reviewed.',
        'general',
        0.75,
        'pending',
        now() - interval '2 hours',
        now() - interval '2 hours'
      );
    end if;
  end if;

  if to_regclass('public.product_mgmt_areas') is not null
     and to_regclass('public.product_mgmt_items') is not null then
    insert into public.product_mgmt_areas (
      area_key,
      label,
      description,
      display_order
    )
    values
      ('bug', 'Bugs', 'Regressions, confusing behavior, and things that should be verified as fixed.', 10),
      ('wishlist', 'Wishlist', 'Useful ideas that should not interrupt the current beta path.', 40),
      ('ai_qa', 'AI / QA', 'AI interpretation quality, prompt behavior, and review tooling.', 50),
      ('admin_ops', 'Admin / Ops', 'Maintenance tools, test data, error visibility, and support workflows.', 60)
    on conflict (area_key) do nothing;

    delete from public.product_mgmt_items
    where title like '[Attention demo]%';

    select id into v_product_area_id
    from public.product_mgmt_areas
    where area_key = 'bug'
    limit 1;

    if v_product_area_id is not null then
      insert into public.product_mgmt_items (
        area_id,
        title,
        body,
        status,
        priority,
        current_version_number,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at
      )
      values (
        v_product_area_id,
        '[Attention demo] Old bug follow-up',
        'This older open item should make the Bugs lane yellow when no newer Bugs items exist.',
        'open',
        'medium',
        1,
        v_admin_user_id,
        v_admin_user_id,
        now() - interval '2 hours',
        now() - interval '2 hours'
      )
      returning id into v_product_item_id;

      if to_regclass('public.product_mgmt_item_versions') is not null then
        insert into public.product_mgmt_item_versions (
          item_id,
          area_id,
          title,
          body,
          status,
          priority,
          version_number,
          change_note,
          created_by_user_id,
          created_at
        )
        values (
          v_product_item_id,
          v_product_area_id,
          '[Attention demo] Old bug follow-up',
          'This older open item should make the Bugs lane yellow when no newer Bugs items exist.',
          'open',
          'medium',
          1,
          'Attention demo seed',
          v_admin_user_id,
          now() - interval '2 hours'
        );
      end if;
    end if;

    select id into v_product_area_id
    from public.product_mgmt_areas
    where area_key = 'ai_qa'
    limit 1;

    if v_product_area_id is not null then
      insert into public.product_mgmt_items (
        area_id,
        title,
        body,
        status,
        priority,
        current_version_number,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at
      )
      values (
        v_product_area_id,
        '[Attention demo] New nested AI / QA item',
        'This newer open item should make Product Mgmt red and the AI / QA lane red.',
        'in_progress',
        'high',
        1,
        v_admin_user_id,
        v_admin_user_id,
        now() - interval '5 minutes',
        now() - interval '5 minutes'
      )
      returning id into v_product_item_id;

      if to_regclass('public.product_mgmt_item_versions') is not null then
        insert into public.product_mgmt_item_versions (
          item_id,
          area_id,
          title,
          body,
          status,
          priority,
          version_number,
          change_note,
          created_by_user_id,
          created_at
        )
        values (
          v_product_item_id,
          v_product_area_id,
          '[Attention demo] New nested AI / QA item',
          'This newer open item should make Product Mgmt red and the AI / QA lane red.',
          'in_progress',
          'high',
          1,
          'Attention demo seed',
          v_admin_user_id,
          now() - interval '5 minutes'
        );
      end if;
    end if;

    select id into v_product_area_id
    from public.product_mgmt_areas
    where area_key = 'wishlist'
    limit 1;

    if v_product_area_id is not null then
      insert into public.product_mgmt_items (
        area_id,
        title,
        body,
        status,
        priority,
        current_version_number,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at
      )
      values (
        v_product_area_id,
        '[Attention demo] New wishlist breadcrumb',
        'This newer wishlist item should make the Wishlist lane red.',
        'open',
        'low',
        1,
        v_admin_user_id,
        v_admin_user_id,
        now() - interval '4 minutes',
        now() - interval '4 minutes'
      )
      returning id into v_product_item_id;

      if to_regclass('public.product_mgmt_item_versions') is not null then
        insert into public.product_mgmt_item_versions (
          item_id,
          area_id,
          title,
          body,
          status,
          priority,
          version_number,
          change_note,
          created_by_user_id,
          created_at
        )
        values (
          v_product_item_id,
          v_product_area_id,
          '[Attention demo] New wishlist breadcrumb',
          'This newer wishlist item should make the Wishlist lane red.',
          'open',
          'low',
          1,
          'Attention demo seed',
          v_admin_user_id,
          now() - interval '4 minutes'
        );
      end if;
    end if;

    select id into v_product_area_id
    from public.product_mgmt_areas
    where area_key = 'admin_ops'
    limit 1;

    if v_product_area_id is not null then
      insert into public.product_mgmt_items (
        area_id,
        title,
        body,
        status,
        priority,
        current_version_number,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at
      )
      values (
        v_product_area_id,
        '[Attention demo] Old admin follow-up',
        'This older Admin / Ops item should make that lane yellow when no newer Admin / Ops item exists.',
        'in_progress',
        'medium',
        1,
        v_admin_user_id,
        v_admin_user_id,
        now() - interval '90 minutes',
        now() - interval '90 minutes'
      )
      returning id into v_product_item_id;

      if to_regclass('public.product_mgmt_item_versions') is not null then
        insert into public.product_mgmt_item_versions (
          item_id,
          area_id,
          title,
          body,
          status,
          priority,
          version_number,
          change_note,
          created_by_user_id,
          created_at
        )
        values (
          v_product_item_id,
          v_product_area_id,
          '[Attention demo] Old admin follow-up',
          'This older Admin / Ops item should make that lane yellow when no newer Admin / Ops item exists.',
          'in_progress',
          'medium',
          1,
          'Attention demo seed',
          v_admin_user_id,
          now() - interval '90 minutes'
        );
      end if;
    end if;
  end if;

  raise notice 'Seeded Admin attention demo records for admin user % and target user %.', v_admin_user_id, v_target_user_id;
end;
$$;
