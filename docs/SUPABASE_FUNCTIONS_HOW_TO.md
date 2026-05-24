# Supabase Functions How-To

Use this when you need to find, run, update, or add a Supabase SQL function/RPC
for CarePland.

## Find An Existing Function

From the repo root:

```bash
rg -n "create (or replace )?function public\\." supabase/sql
```

To search for app calls into Supabase RPCs:

```bash
rg -n "supabase\\.rpc|\\.rpc\\(" app
```

To find one function by name:

```bash
rg -n "function public\\.function_name|rpc\\(\"function_name\"" supabase/sql app
```

## Read A Function Safely

Check these things before changing or reusing a function:

- Function name and parameters.
- Whether it is `security definer`.
- Whether it calls `assert_current_user_is_admin()` or another permission guard.
- Which tables it reads or writes.
- Its `grant execute` line.
- Whether the app already calls it through `supabase.rpc(...)`.

## Run A Function From Supabase SQL Editor

For read-only table-returning functions:

```sql
select *
from public.function_name();
```

For JSON/status helpers:

```sql
select public.function_name('example@example.com');
```

For app-session admin functions, Supabase SQL Editor may not have the app auth
session needed by `auth.uid()`. In that case use a clearly named SQL Editor
utility instead of weakening the app-facing function.

## Add A New Function

Prefer this pattern:

```sql
create or replace function public.function_name(
  p_example text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_current_user_is_admin();

  -- Work here.

  return jsonb_build_object('status', 'ok');
end;
$$;

grant execute on function public.function_name(text)
  to authenticated;
```

Use `returns table (...)` for admin reports and `returns jsonb` for simple
status/action helpers.

## Naming Conventions

- `admin_*`: admin-only app RPCs.
- `get_admin_*`: admin read/report RPCs.
- `seed_*`: sample/demo setup utilities.
- `remove_*` / `reset_*`: one-off cleanup utilities.
- `sql_editor_*`: utilities intended for direct Supabase SQL Editor use.
- `touch_*`: trigger or timestamp helpers.

## Safety Rules

- Do not expose service-role behavior through browser/client code.
- Do not remove admin guards from app-facing admin functions.
- One-off maintenance SQL should say exactly what it touches and what it does
  not touch.
- Preserve audit trails when revealing sensitive data, changing AI/Dynamic Text,
  or mutating support/admin workflows.
- When a new function materially changes architecture or business behavior,
  update `docs/CAREPLAND_STABLE_PROJECT_CONTEXT.md`.

## Archive The SQL

When a function is created or changed, keep the SQL in `supabase/sql/` with a
dated filename:

```text
supabase/sql/YYYY-MM-DD_short_description.sql
```

Then add a short entry to `supabase/sql/README.md`.
