#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const defaultPaths = {
  users: "/Users/agoodloe/Downloads/Users.csv",
  details: "/Users/agoodloe/Downloads/Appointment_details.csv",
  tasks: "/Users/agoodloe/Downloads/Errands_Tasks (1).csv",
};

const realAdopterKeyPatterns = [
  /^AnneGross/i,
  /^DuePayer/i,
  /^CousinAnn/i,
  /^ArtemisTwo/i,
  /^PaulWilcox/i,
  /^MikeRobinson/i,
  /^KatieKantar/i,
  /^JohnnyWalker/i,
  /^AndrewGoodloe637931$/i,
];

const placeholderEmailDomains = new Set(["carepland.com"]);
const placeholderEmails = new Set(["a@a.com", "b@b.com", "cp@cp.com"]);

function parseArgs(argv) {
  const args = {
    allowPlaceholderEmails: false,
    dryRun: true,
    emailMapPath: "",
    execute: false,
    output: resolve(repoRoot, "tmp/adalo-import/dry-run.json"),
    resetPasswords: false,
    tempPassword: "",
    ...defaultPaths,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--execute") {
      args.execute = true;
      args.dryRun = false;
    } else if (arg === "--allow-placeholder-emails") {
      args.allowPlaceholderEmails = true;
    } else if (arg === "--reset-passwords") {
      args.resetPasswords = true;
    } else if (arg === "--temp-password" && next) {
      args.tempPassword = next;
      index += 1;
    } else if (arg === "--users" && next) {
      args.users = resolve(next);
      index += 1;
    } else if (arg === "--details" && next) {
      args.details = resolve(next);
      index += 1;
    } else if (arg === "--tasks" && next) {
      args.tasks = resolve(next);
      index += 1;
    } else if (arg === "--email-map" && next) {
      args.emailMapPath = resolve(next);
      index += 1;
    } else if (arg === "--output" && next) {
      args.output = resolve(next);
      index += 1;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/import-adalo-early-adopters.mjs [options]

Default mode is dry-run. It writes a review plan and does not contact Supabase.

Options:
  --execute                    Create/update Supabase auth, profile, care circle, appointments, notes, and CarePrep
  --reset-passwords            When executing, reset existing matched users to generated temporary passwords
  --temp-password value        Use this temporary password instead of generated per-user passwords
                                Requires at least 8 characters. Works with new users and --reset-passwords.
  --allow-placeholder-emails   Permit b@b.com, a@a.com, cp@cp.com, and @carepland.com login aliases
                                These users are marked as requiring an email update.
  --email-map path.json        JSON object mapping old UID_api values to real login emails
  --users path.csv             Users CSV path
  --details path.csv           Appointment_details CSV path
  --tasks path.csv             Errands_Tasks CSV path
  --output path.json           Dry-run/execution report path
`);
}

function loadDotEnv(path) {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
    }
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (value || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  const [headers = [], ...dataRows] = rows;
  return dataRows
    .filter((dataRow) => dataRow.some((cell) => clean(cell)))
    .map((dataRow) =>
      Object.fromEntries(headers.map((header, index) => [header, dataRow[index] ?? ""]))
    );
}

function readCsv(path) {
  return parseCsv(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function clean(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .trim();
}

function bool(value) {
  return ["true", "yes", "1"].includes(clean(value).toLowerCase());
}

function compactList(values) {
  return values.map(clean).filter(Boolean);
}

function lines(value) {
  return clean(value)
    .split(/\r?\n|,(?=[A-Z])/)
    .map(clean)
    .filter(Boolean);
}

function normalizeEmail(email) {
  return clean(email).toLowerCase();
}

function emailLooksPlaceholder(email) {
  const normalized = normalizeEmail(email);
  const domain = normalized.split("@")[1] ?? "";
  return placeholderEmails.has(normalized) || placeholderEmailDomains.has(domain);
}

function accountKey(row) {
  return clean(row.UID_api) || clean(row["UID."]) || clean(row.Username);
}

function keyMatchesRealAdopter(key) {
  return realAdopterKeyPatterns.some((pattern) => pattern.test(clean(key)));
}

function rowMatchesRealAdopter(row) {
  return keyMatchesRealAdopter(accountKey(row)) || keyMatchesRealAdopter(row.Username);
}

function displayNameForUser(row) {
  return (
    clean(row["First & Last Name"]) ||
    compactList([row["First Name"], row["Last Name"]]).join(" ") ||
    clean(row.Username) ||
    clean(row.Email)
  );
}

function providerNameFromTask(task) {
  return compactList([
    task.provider_honorific,
    task.provider_firstname,
    task.provider_lastname,
  ]).join(" ");
}

function appointmentTitle(task, detail) {
  return clean(detail?.Name) || clean(task?.description) || "Imported appointment";
}

function appointmentReason(task, detail) {
  return clean(detail?.["reason-visit_type"]) || clean(task?.description) || null;
}

function careSubjectName(account, task) {
  return clean(task?.["Care Recipient Full Name"]) || displayNameForUser(account);
}

function notePayload(detail) {
  if (!detail) {
    return null;
  }

  const summary = clean(detail.summary_70) || clean(detail.gpt_summary);
  const takeaways = compactList([
    detail.top_3_takeaways_1,
    detail.top_3_takeaways_2,
    detail.top_3_takeaways_3,
  ]);
  const followups = lines(detail.followup_actions);
  const transcript = clean(detail.combined_transcript);

  if (!summary && takeaways.length === 0 && followups.length === 0 && !transcript) {
    return null;
  }

  return {
    followups,
    input_text: transcript || summary || null,
    source: "legacy_adalo",
    summary_short: summary || transcript || null,
    takeaways,
  };
}

function guidancePayload(task) {
  const summary = clean(task?.pre_visit_summary) || clean(task?.guidance_summary_320);
  const bringList = lines(task?.bring_list);
  const keyQuestions = lines(task?.key_questions);
  const sinceLastVisit = lines(task?.since_last_visit);
  const medReview = lines(task?.med_review);
  const watchouts = lines(task?.watchouts);
  const nextSteps = lines(task?.next_steps_suggested);

  if (
    !summary &&
    bringList.length === 0 &&
    keyQuestions.length === 0 &&
    sinceLastVisit.length === 0 &&
    medReview.length === 0 &&
    watchouts.length === 0 &&
    nextSteps.length === 0
  ) {
    return null;
  }

  return {
    bring_list: bringList,
    key_questions: keyQuestions,
    med_review: medReview,
    next_steps: nextSteps,
    review_status: bool(task?.guidance_ready) ? "accepted" : "draft",
    since_last_visit: sinceLastVisit,
    source: "legacy_adalo",
    summary,
    watchouts,
  };
}

function isAppointmentTask(task) {
  return Boolean(
    clean(task.appt_detail_id) ||
      bool(task["Is appointment?"]) ||
      clean(task["Errand Category"]) === "Medical Appointment" ||
      clean(task.practice_name) ||
      clean(task.provider_role) ||
      clean(task["Errand DTTM"])
  );
}

function buildPlan({ details, emailMap, tasks, users, allowPlaceholderEmails }) {
  const detailById = new Map(details.map((detail) => [clean(detail.ID), detail]));
  const tasksByDetailId = new Map();
  for (const task of tasks) {
    const detailId = clean(task.appt_detail_id);
    if (detailId) {
      tasksByDetailId.set(detailId, task);
    }
  }

  const realRows = users.filter(rowMatchesRealAdopter);
  const accountRows = new Map();
  for (const row of realRows) {
    const key = accountKey(row);
    if (!key) {
      continue;
    }

    const current = accountRows.get(key);
    const currentHasEmail = Boolean(clean(current?.Email));
    const rowIsExactUsernameMatch = clean(row.Username) === key;
    const currentIsExactUsernameMatch = clean(current?.Username) === key;
    if (
      !current ||
      (rowIsExactUsernameMatch && !currentIsExactUsernameMatch) ||
      (!currentHasEmail && clean(row.Email))
    ) {
      accountRows.set(key, row);
    }
  }

  const accounts = [];
  for (const [oldUid, row] of accountRows.entries()) {
    const mappedEmail = emailMap[oldUid] ? clean(emailMap[oldUid]) : "";
    const email = mappedEmail || clean(row.Email);
    const placeholderEmail = emailLooksPlaceholder(email);
    const requiresEmailUpdate = placeholderEmail;
    const canImportAccount =
      Boolean(email) && (allowPlaceholderEmails || !placeholderEmail);
    const accountTasks = tasks
      .filter(
        (task) =>
          isAppointmentTask(task) &&
          [task.UID, task["Care Coordinator"], task.errand_creator_username, task["Errand Care Recipient"]]
            .map(clean)
            .includes(oldUid)
      )
      .sort((first, second) => clean(first["Errand DTTM"]).localeCompare(clean(second["Errand DTTM"])));

    const taskIds = new Set(accountTasks.map((task) => clean(task.ID)));
    const accountDetails = details.filter((detail) =>
      [detail.uid, detail.created_by_username, detail.care_recip_user_id]
        .map(clean)
        .includes(oldUid)
    );

    const appointments = [];
    for (const task of accountTasks) {
      const detail = detailById.get(clean(task.appt_detail_id));
      appointments.push(buildAppointmentPlan(row, oldUid, task, detail));
    }

    for (const detail of accountDetails) {
      if (taskIds.has(clean(detail.id_number))) {
        continue;
      }

      appointments.push(buildAppointmentPlan(row, oldUid, null, detail));
    }

    accounts.push({
      appointments,
      canImportAccount,
      displayName: displayNameForUser(row),
      email,
      familyName: clean(row["Last Name"]),
      givenName: clean(row["First Name"]),
      oldAccountId: clean(row.ID),
      oldTestFlag: clean(row["test account?"]),
      oldUid,
      phoneE164: clean(row["phone number (SMS/E.164 format)"]) || null,
      placeholderEmail,
      planId: "personal",
      requiresEmailUpdate,
      sourceUsername: clean(row.Username),
      timezone: clean(row["Time Zone"]) || "America/Los_Angeles",
      warnings: [
        ...(placeholderEmail
          ? [
              allowPlaceholderEmails
                ? `Login alias requires user email update: ${email}`
                : `Placeholder/login-alias email requires review: ${email}`,
            ]
          : []),
        ...(canImportAccount
          ? []
          : [
              "Account will be skipped until a real email is provided or login aliases are explicitly allowed.",
            ]),
      ],
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    inputFiles: {
      details: basename(defaultPaths.details),
      tasks: basename(defaultPaths.tasks),
      users: basename(defaultPaths.users),
    },
    summary: {
      accounts: accounts.length,
      appointments: accounts.reduce((total, account) => total + account.appointments.length, 0),
      blockedAccounts: accounts.filter((account) => !account.canImportAccount).length,
      notes: accounts.reduce(
        (total, account) => total + account.appointments.filter((appointment) => appointment.note).length,
        0
      ),
      careprep: accounts.reduce(
        (total, account) => total + account.appointments.filter((appointment) => appointment.guidance).length,
        0
      ),
    },
    accounts,
  };
}

function buildAppointmentPlan(account, oldUid, task, detail) {
  const startsAt = clean(task?.["Errand DTTM"]) || clean(detail?.appt_dttm) || null;
  const providerName = providerNameFromTask(task ?? {}) || clean(detail?.provider_name) || null;
  const providerOrganization = clean(task?.practice_name) || null;
  const locationAddress = clean(task?.address_text) || clean(task?.address) || clean(detail?.appt_location) || null;
  const locationPhone = clean(task?.e164_phone) || null;
  const note = notePayload(detail);
  const guidance = guidancePayload(task);

  return {
    careSubjectName: careSubjectName(account, task),
    guidance,
    location_address: locationAddress,
    location_name: providerOrganization,
    location_phone: locationPhone,
    note,
    oldDetailId: clean(detail?.ID) || null,
    oldTaskId: clean(task?.ID) || clean(detail?.id_number) || null,
    ownerOldUid: oldUid,
    provider_name: providerName,
    provider_organization: providerOrganization,
    reason: appointmentReason(task, detail),
    source: "legacy_adalo",
    starts_at: startsAt,
    status: "scheduled",
    title: appointmentTitle(task, detail),
  };
}

function requireSupabaseEnv() {
  loadDotEnv(resolve(repoRoot, ".env.local"));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Execution requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return { anonKey, serviceRoleKey, supabaseUrl };
}

function temporaryPassword() {
  return `CarePland-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}!`;
}

function importPassword(args) {
  const password = clean(args.tempPassword);

  if (!password) {
    return temporaryPassword();
  }

  if (password.length < 8) {
    throw new Error("--temp-password must be at least 8 characters.");
  }

  return password;
}

async function findAuthUserByEmail(adminClient, email) {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const found = data.users.find(
      (user) => normalizeEmail(user.email) === normalizeEmail(email)
    );
    if (found) {
      return found;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function ensureAuthAndProfile({ account, anonKey, adminClient, password, resetPasswords, supabaseUrl }) {
  const existingUser = await findAuthUserByEmail(adminClient, account.email);
  let user = existingUser;
  let passwordForLogin = password;

  if (!existingUser) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: account.email,
      email_confirm: true,
      password,
      user_metadata: {
        display_name: account.displayName,
        legacy_adalo_uid: account.oldUid,
        requires_email_update: account.requiresEmailUpdate,
      },
    });

    if (error) {
      throw error;
    }

    user = data.user;
  } else if (resetPasswords) {
    const { data, error } = await adminClient.auth.admin.updateUserById(existingUser.id, {
      password,
      user_metadata: {
        ...(existingUser.user_metadata ?? {}),
        display_name: account.displayName,
        legacy_adalo_uid: account.oldUid,
        requires_email_update: account.requiresEmailUpdate,
      },
    });

    if (error) {
      throw error;
    }

    user = data.user;
  } else {
    passwordForLogin = null;
  }

  if (!user) {
    throw new Error(`Could not create or find auth user for ${account.email}`);
  }

  if (!passwordForLogin) {
    return { password: null, user, warning: "Existing user found; profile setup and data import were skipped without --reset-passwords." };
  }

  const userClient = createClient(supabaseUrl, anonKey);
  const { error: signInError } = await userClient.auth.signInWithPassword({
    email: account.email,
    password: passwordForLogin,
  });

  if (signInError) {
    throw signInError;
  }

  const { error: profileError } = await userClient.from("profiles").upsert({
    display_name: account.displayName,
    email: account.email,
    family_name: account.familyName || null,
    given_name: account.givenName || null,
    id: user.id,
    onboarding_completed_at: new Date().toISOString(),
    phone_e164: account.phoneE164,
    timezone: account.timezone,
  });

  if (profileError) {
    throw profileError;
  }

  const { error: setupError } = await userClient.rpc("ensure_personal_account_setup");
  if (setupError) {
    throw setupError;
  }

  await userClient.auth.signOut();
  return { password: passwordForLogin, user, warning: null };
}

async function primaryCareContext(adminClient, userId) {
  const { data: membership, error: membershipError } = await adminClient
    .from("care_circle_memberships")
    .select("care_circle_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (membershipError) {
    throw membershipError;
  }

  return { careCircleId: membership.care_circle_id };
}

async function ensureCareSubject(adminClient, { careCircleId, name }) {
  const { data: existing, error: existingError } = await adminClient
    .from("care_subjects")
    .select("id")
    .eq("care_circle_id", careCircleId)
    .eq("display_name", name)
    .limit(1);

  if (existingError) {
    throw existingError;
  }

  if (existing?.[0]?.id) {
    return existing[0].id;
  }

  const { data, error } = await adminClient
    .from("care_subjects")
    .insert({
      care_circle_id: careCircleId,
      display_name: name,
      is_active: true,
      is_default: false,
      subject_type: "other",
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

async function appointmentExists(adminClient, { careCircleId, startsAt, title }) {
  let query = adminClient
    .from("appointments")
    .select("id,current_note_id")
    .eq("care_circle_id", careCircleId)
    .eq("title", title)
    .eq("source", "legacy_adalo")
    .limit(1);

  query = startsAt ? query.eq("starts_at", startsAt) : query.is("starts_at", null);
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data?.[0] ?? null;
}

async function importAppointment(adminClient, { appointment, careCircleId, subjectId, userId }) {
  const duplicate = await appointmentExists(adminClient, {
    careCircleId,
    startsAt: appointment.starts_at,
    title: appointment.title,
  });

  if (duplicate) {
    return { appointmentId: duplicate.id, skipped: true };
  }

  const { data: inserted, error: insertError } = await adminClient
    .from("appointments")
    .insert({
      care_circle_id: careCircleId,
      care_subject_id: subjectId,
      location_address: appointment.location_address,
      location_name: appointment.location_name,
      location_phone: appointment.location_phone,
      owner_user_id: userId,
      provider_name: appointment.provider_name,
      provider_organization: appointment.provider_organization,
      reason: appointment.reason,
      source: "legacy_adalo",
      starts_at: appointment.starts_at,
      status: appointment.status,
      title: appointment.title,
    })
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  let noteId = null;
  if (appointment.note) {
    const { data: note, error: noteError } = await adminClient
      .from("appointment_notes")
      .insert({
        accepted_by_user: true,
        appointment_id: inserted.id,
        care_circle_id: careCircleId,
        followups: appointment.note.followups,
        generated_by_ai: false,
        input_text: appointment.note.input_text,
        is_current: true,
        source: "legacy_adalo",
        summary_short: appointment.note.summary_short,
        takeaways: appointment.note.takeaways,
        user_id: userId,
        version_number: 1,
      })
      .select("id")
      .single();

    if (noteError) {
      throw noteError;
    }

    noteId = note.id;
    const { error: updateAppointmentError } = await adminClient
      .from("appointments")
      .update({ current_note_id: noteId })
      .eq("id", inserted.id);

    if (updateAppointmentError) {
      throw updateAppointmentError;
    }
  }

  let guidanceId = null;
  if (appointment.guidance) {
    const { data: guidance, error: guidanceError } = await adminClient
      .from("careprep_guidance")
      .insert({
        appointment_id: inserted.id,
        bring_list: appointment.guidance.bring_list,
        care_circle_id: careCircleId,
        generated_at: new Date().toISOString(),
        input_context_snapshot: {
          legacy_adalo_detail_id: appointment.oldDetailId,
          legacy_adalo_task_id: appointment.oldTaskId,
        },
        is_current: appointment.guidance.review_status === "accepted",
        key_questions: appointment.guidance.key_questions,
        med_review: appointment.guidance.med_review,
        model: "legacy_adalo",
        next_steps: appointment.guidance.next_steps,
        prompt_version: "legacy_adalo_import",
        review_status: appointment.guidance.review_status,
        since_last_visit: appointment.guidance.since_last_visit,
        source: "legacy_adalo",
        status: "succeeded",
        summary: appointment.guidance.summary,
        user_id: userId,
        version_number: 1,
        watchouts: appointment.guidance.watchouts,
      })
      .select("id")
      .single();

    if (guidanceError) {
      throw guidanceError;
    }

    guidanceId = guidance.id;
  }

  return { appointmentId: inserted.id, guidanceId, noteId, skipped: false };
}

async function executePlan(plan, args) {
  const { anonKey, serviceRoleKey, supabaseUrl } = requireSupabaseEnv();
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const credentials = [];
  const results = [];

  for (const account of plan.accounts) {
    if (!account.canImportAccount) {
      results.push({ oldUid: account.oldUid, status: "skipped", warnings: account.warnings });
      continue;
    }

    const authResult = await ensureAuthAndProfile({
      account,
      adminClient,
      anonKey,
      password: importPassword(args),
      resetPasswords: args.resetPasswords,
      supabaseUrl,
    });

    if (authResult.password) {
      credentials.push({
        displayName: account.displayName,
        email: account.email,
        temporaryPassword: authResult.password,
      });
    }

    if (authResult.warning) {
      results.push({ oldUid: account.oldUid, status: "partial", warning: authResult.warning });
      continue;
    }

    const { careCircleId } = await primaryCareContext(adminClient, authResult.user.id);
    const appointmentResults = [];
    for (const appointment of account.appointments) {
      const subjectId = await ensureCareSubject(adminClient, {
        careCircleId,
        name: appointment.careSubjectName,
      });
      appointmentResults.push(
        await importAppointment(adminClient, {
          appointment,
          careCircleId,
          subjectId,
          userId: authResult.user.id,
        })
      );
    }

    results.push({
      appointments: appointmentResults,
      oldUid: account.oldUid,
      status: "imported",
      userId: authResult.user.id,
    });
  }

  return { credentials, results };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const emailMap = args.emailMapPath
    ? JSON.parse(readFileSync(args.emailMapPath, "utf8"))
    : {};
  const users = readCsv(args.users);
  const details = readCsv(args.details);
  const tasks = readCsv(args.tasks);
  const plan = buildPlan({
    allowPlaceholderEmails: args.allowPlaceholderEmails,
    details,
    emailMap,
    tasks,
    users,
  });

  if (args.execute) {
    plan.execution = await executePlan(plan, args);
  }

  writeFileSync(args.output, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(
    `${args.execute ? "Import execution" : "Dry run"} complete: ${args.output}`
  );
  console.log(JSON.stringify(plan.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
