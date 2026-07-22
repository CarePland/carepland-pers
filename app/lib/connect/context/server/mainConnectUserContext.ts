import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createSupabaseServiceClient,
  createSupabaseUserClient,
  getActiveSupabaseUser,
} from "../../../platform/server/supabase";
import { careplandRuntimeTempPath } from "../../../platform/server/runtimeTemp";
import { connectAvatarAltText } from "../../avatar";
import {
  isConnectPetSubjectType,
  isEligibleMainConnectUserPerson,
} from "../mainConnectUserEligibility";
import type { ConnectMainUserContext, ConnectPersPerson } from "../types";
import { readPrimaryCoordinatorForCareCircle } from "./primaryCoordinator";

type LocalConnectSettings = {
  main_connect_user_person_id: string | null;
  updated_at: string;
  version: 1;
};

type CareSubjectRow = {
  account_user_id?: string | null;
  avatar_alt_text?: string | null;
  avatar_type?: "generated" | "initials" | "uploaded" | null;
  avatar_url?: string | null;
  care_circle_id: string;
  display_name: string | null;
  id: string;
  is_active: boolean | null;
  is_default: boolean | null;
  managed_by_household?: boolean | null;
  subject_type: string | null;
};

type CareCircleMembershipRow = {
  care_circle_id: string;
};

type ProfileRow = {
  display_name: string | null;
  email: string | null;
  family_name: string | null;
  given_name: string | null;
};

type ConnectSettingsRow = {
  main_connect_user_person_id: string | null;
};

type ConnectUserContext = {
  accessToken: string;
  userId: string;
};

export class ConnectPersonAccessDeniedError extends Error {
  constructor() {
    super("Choose a Main Connect User from your CarePland collection.");
    this.name = "ConnectPersonAccessDeniedError";
  }
}

export function accessTokenFromConnectRequest(request: Request) {
  return (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

export async function verifyConnectPersonAccessForRequest(
  personId: string,
  request: Request
) {
  const normalizedPersonId = personId.trim();
  const accessToken = accessTokenFromConnectRequest(request);
  const userContext = await createConnectUserContext(accessToken);
  const person = await findConnectPersonForUser(normalizedPersonId, userContext);

  if (!person || !isEligibleMainConnectUserPerson(person)) {
    throw new ConnectPersonAccessDeniedError();
  }

  return {
    accessToken,
    careCircleId: person.careCircleId,
    mainConnectUserPersonId: normalizedPersonId,
    userContext,
  };
}

export async function readConnectMainUserContext(
  userContext: ConnectUserContext
): Promise<ConnectMainUserContext> {
  const settingsPath = connectSettingsPathForUser(userContext.userId);
  const [settingsResult, people, currentAccountProfile] = await Promise.all([
    readConnectSettings(userContext, settingsPath),
    listPersPeopleForConnect(userContext),
    readCurrentAccountProfile(userContext),
  ]);
  const { settings, source } = settingsResult;
  const mainConnectUserPerson =
    people.find(
      (person) =>
        person.id === settings.main_connect_user_person_id &&
        isEligibleMainConnectUserPerson(person)
    ) ?? null;
  const currentAccountPerson = people.find((person) => person.isCurrentUser) ?? null;
  const primaryCoordinator = await readPrimaryCoordinatorForCareCircle(
    mainConnectUserPerson?.careCircleId ?? people[0]?.careCircleId ?? null
  );

  return {
    currentAccountProfile,
    currentAccountPerson,
    currentAccountPersonId: currentAccountPerson?.id ?? null,
    mainConnectUserPerson,
    mainConnectUserPersonId: mainConnectUserPerson?.id ?? null,
    people,
    primaryCoordinator,
    source: mainConnectUserPerson ? source : "unset",
  };
}

export async function updateConnectMainUserContextForUser(
  personId: string,
  userContext: ConnectUserContext
) {
  const people = await listPersPeopleForConnect(userContext);
  const person = people.find((item) => item.id === personId);

  if (!person) {
    throw new Error("Main Connect User must be an existing active CarePland person.");
  }

  if (isConnectPetSubjectType(person.subjectType)) {
    throw new Error("Pets cannot be selected as the Main Connect User.");
  }

  const currentAccountPerson = people.find((item) => item.isCurrentUser) ?? null;
  const currentAccountProfile = await readCurrentAccountProfile(userContext);

  const source = await writeConnectSettings(
    {
      main_connect_user_person_id: person.id,
      updated_at: new Date().toISOString(),
      version: 1,
    },
    userContext,
    connectSettingsPathForUser(userContext.userId)
  );

  return {
    currentAccountProfile,
    currentAccountPerson,
    currentAccountPersonId: currentAccountPerson?.id ?? null,
    mainConnectUserPerson: person,
    mainConnectUserPersonId: person.id,
    people,
    primaryCoordinator: await readPrimaryCoordinatorForCareCircle(person.careCircleId),
    source,
  } satisfies ConnectMainUserContext;
}

export async function ensureConnectCurrentAccountPerson(
  userContext: ConnectUserContext
): Promise<ConnectMainUserContext> {
  let context = await readConnectMainUserContext(userContext);

  if (context.currentAccountPerson) {
    return context;
  }

  const supabase = createSupabaseUserClient(userContext.accessToken);
  const setupResult = await supabase.rpc("ensure_personal_account_setup");

  if (setupResult.error && !isMissingRpc(setupResult.error)) {
    throw setupResult.error;
  }

  await ensureCareSubjectForCurrentAccount(userContext);
  context = await readConnectMainUserContext(userContext);

  if (!context.currentAccountPerson) {
    throw new Error(
      "CarePland could not create your Receiver User yet. Please save your profile and try again."
    );
  }

  return context;
}

async function readCurrentAccountProfile(userContext: ConnectUserContext) {
  const supabase = createSupabaseUserClient(userContext.accessToken);
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name,given_name,family_name,email")
    .eq("id", userContext.userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    displayName: accountPersonDisplayName(data as ProfileRow | null),
  };
}

function petSubjectTypeEmoji(subjectType?: string | null) {
  const normalizedType = String(subjectType || "").trim().toLowerCase();

  if (normalizedType === "cat") {
    return "🐱";
  }

  if (normalizedType === "dog") {
    return "🐶";
  }

  if (normalizedType === "pet" || normalizedType.startsWith("pet:")) {
    return "🐾";
  }

  return undefined;
}

async function ensureCareSubjectForCurrentAccount(
  userContext: ConnectUserContext
) {
  const userClient = createSupabaseUserClient(userContext.accessToken);
  const serviceClient = createSupabaseServiceClient();
  const { data: profileData, error: profileError } = await userClient
    .from("profiles")
    .select("display_name,given_name,family_name,email")
    .eq("id", userContext.userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const { data: memberships, error: membershipsError } = await userClient
    .from("care_circle_memberships")
    .select("care_circle_id")
    .eq("user_id", userContext.userId)
    .eq("status", "active")
    .limit(1);

  if (membershipsError) {
    throw membershipsError;
  }

  const careCircleId = ((memberships ?? []) as CareCircleMembershipRow[])[0]
    ?.care_circle_id;

  if (!careCircleId) {
    throw new Error("No CarePland household was found for this account.");
  }

  const { data: existingAccountPerson, error: accountPersonError } = await serviceClient
    .from("care_subjects")
    .select("id")
    .eq("care_circle_id", careCircleId)
    .eq("is_active", true)
    .eq("account_user_id", userContext.userId)
    .maybeSingle();

  if (accountPersonError) {
    if (isMissingCareSubjectOptionalColumn(accountPersonError)) {
      throw new Error(
        "Receiver Setup needs a CarePland update before it can add you as a Receiver User."
      );
    }

    throw accountPersonError;
  }

  if (existingAccountPerson) {
    return;
  }

  const { count: activePersonCount, error: countError } = await serviceClient
    .from("care_subjects")
    .select("id", { count: "exact", head: true })
    .eq("care_circle_id", careCircleId)
    .eq("is_active", true);

  if (countError) {
    throw countError;
  }

  const profile = profileData as ProfileRow | null;
  const displayName = accountPersonDisplayName(profile);
  const normalizedDisplayName = normalizedPersonName(displayName);
  const { data: matchingPeople, error: matchingPeopleError } = await serviceClient
    .from("care_subjects")
    .select("id,display_name,account_user_id")
    .eq("care_circle_id", careCircleId)
    .eq("is_active", true);

  if (matchingPeopleError) {
    if (isMissingCareSubjectOptionalColumn(matchingPeopleError)) {
      throw new Error(
        "Receiver Setup needs a CarePland update before it can add you as a Receiver User."
      );
    }

    throw matchingPeopleError;
  }

  const matchingUnlinkedPerson = ((matchingPeople ?? []) as CareSubjectRow[]).find(
    (person) =>
      !person.account_user_id &&
      normalizedPersonName(person.display_name) === normalizedDisplayName
  );

  if (matchingUnlinkedPerson) {
    const { error: linkError } = await serviceClient
      .from("care_subjects")
      .update({ account_user_id: userContext.userId })
      .eq("id", matchingUnlinkedPerson.id);

    if (linkError) {
      throw linkError;
    }

    return;
  }

  const { error: insertError } = await serviceClient.from("care_subjects").insert({
    account_user_id: userContext.userId,
    care_circle_id: careCircleId,
    display_name: displayName,
    is_active: true,
    is_default: (activePersonCount ?? 0) === 0,
    managed_by_household: false,
    subject_type: "other",
  });

  if (insertError) {
    if (isMissingCareSubjectOptionalColumn(insertError)) {
      throw new Error(
        "Receiver Setup needs a CarePland update before it can add you as a Receiver User."
      );
    }

    throw insertError;
  }
}

function accountPersonDisplayName(profile: ProfileRow | null) {
  const fullName = [profile?.given_name, profile?.family_name]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");

  return (
    profile?.display_name?.trim() ||
    fullName ||
    profile?.given_name?.trim() ||
    profile?.email?.trim() ||
    "You"
  );
}

function normalizedPersonName(value?: string | null) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export async function createConnectUserContext(accessToken: string) {
  if (!accessToken) {
    throw new Error("Please sign in before loading Connect people.");
  }

  const supabase = createSupabaseUserClient(accessToken);
  const user = await getActiveSupabaseUser(
    supabase,
    "Please sign in before loading Connect people."
  );

  return { accessToken, userId: user.id } satisfies ConnectUserContext;
}

export async function connectUserCanAccessPerson(
  personId: string,
  userContext: ConnectUserContext
) {
  return Boolean(await findConnectPersonForUser(personId, userContext));
}

async function findConnectPersonForUser(
  personId: string,
  userContext: ConnectUserContext
) {
  const people = await listPersPeopleForConnect(userContext);

  return people.find((person) => person.id === personId) ?? null;
}

export async function listPersPeopleForConnect(
  userContext: ConnectUserContext
): Promise<ConnectPersPerson[]> {
  const userClient = createSupabaseUserClient(userContext.accessToken);
  const serviceClient = createSupabaseServiceClient();
  const { data: memberships, error: membershipsError } = await userClient
    .from("care_circle_memberships")
    .select("care_circle_id")
    .eq("user_id", userContext.userId);

  if (membershipsError) {
    throw membershipsError;
  }

  const careCircleIds = Array.from(
    new Set(
      ((memberships ?? []) as CareCircleMembershipRow[])
        .map((membership) => membership.care_circle_id)
        .filter(Boolean)
    )
  );

  if (careCircleIds.length === 0) {
    return [];
  }

  const careSubjectsQuery = serviceClient
    .from("care_subjects")
    .select("id,care_circle_id,display_name,subject_type,is_default,is_active,managed_by_household,account_user_id,avatar_url,avatar_type,avatar_alt_text")
    .in("care_circle_id", careCircleIds)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("display_name", { ascending: true });

  const careSubjectsResult = await careSubjectsQuery;
  let data = careSubjectsResult.data as CareSubjectRow[] | null;
  const error = careSubjectsResult.error;

  if (error) {
    if (!isMissingCareSubjectOptionalColumn(error)) {
      throw error;
    }

    const fallbackQuery = serviceClient
      .from("care_subjects")
      .select("id,care_circle_id,display_name,subject_type,is_default,is_active")
      .in("care_circle_id", careCircleIds)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("display_name", { ascending: true });

    const fallbackResult = await fallbackQuery;

    if (fallbackResult.error) {
      throw fallbackResult.error;
    }

    data = (fallbackResult.data ?? []).map((row) => ({
      ...row,
      avatar_alt_text: null,
      avatar_type: null,
      avatar_url: null,
      managed_by_household: false,
    })) as CareSubjectRow[];
  }

  // Until participant management exists, setup must be able to choose from
  // active Care VIPs even before explicit Connect participant rows exist.
  const people = ((data ?? []) as CareSubjectRow[])
    .filter((row) => row.id && row.care_circle_id)
    .map((row) => ({
      avatarAltText: row.avatar_alt_text ?? undefined,
      avatarEmoji: petSubjectTypeEmoji(row.subject_type),
      avatarType: row.avatar_type ?? "initials",
      avatarUrl: row.avatar_url ?? undefined,
      careCircleId: row.care_circle_id,
      displayName: row.display_name?.trim() || "Unnamed Care VIP",
      id: row.id,
      isActive: row.is_active !== false,
      isCurrentUser: row.account_user_id === userContext.userId,
      isDefault: row.is_default === true,
      managedByHousehold: row.managed_by_household === true,
      subjectType: row.subject_type ?? undefined,
    }));

  return Promise.all(
    dedupeCurrentAccountPersonClones(people).map(async (person) => ({
      ...person,
      avatarAltText: person.avatarAltText ?? connectAvatarAltText(person),
      avatarUrl: await signedAvatarUrl(person.avatarUrl),
    }))
  );
}

export async function listPersFocusPeopleForConnect(
  userContext: ConnectUserContext
): Promise<ConnectPersPerson[]> {
  const userClient = createSupabaseUserClient(userContext.accessToken);
  const serviceClient = createSupabaseServiceClient();
  const { data: memberships, error: membershipsError } = await userClient
    .from("care_circle_memberships")
    .select("care_circle_id")
    .eq("user_id", userContext.userId);

  if (membershipsError) {
    throw membershipsError;
  }

  const careCircleIds = Array.from(
    new Set(
      ((memberships ?? []) as CareCircleMembershipRow[])
        .map((membership) => membership.care_circle_id)
        .filter(Boolean)
    )
  );

  if (careCircleIds.length === 0) {
    return [];
  }

  const careSubjectsQuery = serviceClient
    .from("care_subjects")
    .select("id,care_circle_id,display_name,subject_type,is_default,is_active,managed_by_household,account_user_id,avatar_url,avatar_type,avatar_alt_text")
    .in("care_circle_id", careCircleIds)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("display_name", { ascending: true });

  const careSubjectsResult = await careSubjectsQuery;
  let data = careSubjectsResult.data as CareSubjectRow[] | null;
  const error = careSubjectsResult.error;

  if (error) {
    if (!isMissingCareSubjectOptionalColumn(error)) {
      throw error;
    }

    const fallbackResult = await serviceClient
      .from("care_subjects")
      .select("id,care_circle_id,display_name,subject_type,is_default,is_active")
      .in("care_circle_id", careCircleIds)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("display_name", { ascending: true });

    if (fallbackResult.error) {
      throw fallbackResult.error;
    }

    data = (fallbackResult.data ?? []).map((row) => ({
      ...row,
      avatar_alt_text: null,
      avatar_type: null,
      avatar_url: null,
      managed_by_household: false,
    })) as CareSubjectRow[];
  }

  const people = ((data ?? []) as CareSubjectRow[])
    .filter((row) => row.id && row.care_circle_id)
    .map((row) => ({
      avatarAltText: row.avatar_alt_text ?? undefined,
      avatarEmoji: petSubjectTypeEmoji(row.subject_type),
      avatarType: row.avatar_type ?? "initials",
      avatarUrl: row.avatar_url ?? undefined,
      careCircleId: row.care_circle_id,
      displayName: row.display_name?.trim() || "Unnamed Care VIP",
      id: row.id,
      isActive: row.is_active !== false,
      isCurrentUser: row.account_user_id === userContext.userId,
      isDefault: row.is_default === true,
      managedByHousehold: row.managed_by_household === true,
      subjectType: row.subject_type ?? undefined,
    }));

  return Promise.all(
    dedupeCurrentAccountPersonClones(people).map(async (person) => ({
      ...person,
      avatarAltText: person.avatarAltText ?? connectAvatarAltText(person),
      avatarUrl: await signedAvatarUrl(person.avatarUrl),
    }))
  );
}

function dedupeCurrentAccountPersonClones(people: ConnectPersPerson[]) {
  const currentAccountPeopleByHouseholdAndName = new Set(
    people
      .filter((person) => person.isCurrentUser)
      .map((person) =>
        `${person.careCircleId}:${normalizedPersonName(person.displayName)}`
      )
  );

  if (!currentAccountPeopleByHouseholdAndName.size) {
    return people;
  }

  return people.filter((person) => {
    if (person.isCurrentUser) {
      return true;
    }

    return !currentAccountPeopleByHouseholdAndName.has(
      `${person.careCircleId}:${normalizedPersonName(person.displayName)}`
    );
  });
}

async function readConnectSettings(
  userContext: ConnectUserContext,
  settingsPath: string
) {
  const supabase = createSupabaseUserClient(userContext.accessToken);
  const { data, error } = await supabase
    .from("connect_settings")
    .select("main_connect_user_person_id")
    .eq("user_id", userContext.userId)
    .maybeSingle();

  if (!error) {
    return {
      settings: {
        main_connect_user_person_id:
          ((data as ConnectSettingsRow | null)?.main_connect_user_person_id ?? null),
        updated_at: "",
        version: 1,
      } satisfies LocalConnectSettings,
      source: "supabase" as const,
    };
  }

  if (!isMissingConnectSettingsTable(error)) {
    throw error;
  }

  return {
    settings: await readLocalConnectSettings(settingsPath),
    source: "local_dev" as const,
  };
}

async function writeConnectSettings(
  settings: LocalConnectSettings,
  userContext: ConnectUserContext,
  settingsPath: string
) {
  const supabase = createSupabaseUserClient(userContext.accessToken);
  const { error } = await supabase.from("connect_settings").upsert({
    main_connect_user_person_id: settings.main_connect_user_person_id,
    updated_at: settings.updated_at,
    user_id: userContext.userId,
  });

  if (!error) {
    return "supabase" as const;
  }

  if (!isMissingConnectSettingsTable(error)) {
    throw error;
  }

  await writeLocalConnectSettings(settings, settingsPath);

  return "local_dev" as const;
}

async function readLocalConnectSettings(
  settingsPath: string
): Promise<LocalConnectSettings> {
  try {
    const parsed = JSON.parse(await readFile(settingsPath, "utf8")) as Partial<
      LocalConnectSettings
    >;

    if (parsed.version === 1) {
      return {
        main_connect_user_person_id: parsed.main_connect_user_person_id ?? null,
        updated_at: parsed.updated_at ?? "",
        version: 1,
      };
    }
  } catch {
    // Start unset; Connect must explicitly choose a Pers person.
  }

  return {
    main_connect_user_person_id: null,
    updated_at: "",
    version: 1,
  };
}

async function writeLocalConnectSettings(
  settings: LocalConnectSettings,
  settingsPath: string
) {
  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

function connectSettingsPathForUser(userId: string) {
  return careplandRuntimeTempPath(
    "connect-settings",
    `${userId}-main-connect-user.json`
  );
}

function isMissingConnectSettingsTable(error: unknown) {
  return isMissingTable(error, "connect_settings");
}

function isMissingRpc(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message ?? "";

  return (
    maybeError.code === "42883" ||
    maybeError.code === "PGRST202" ||
    message.includes("ensure_personal_account_setup")
  );
}

function isMissingTable(error: unknown, tableName: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message ?? "";

  return (
    maybeError.code === "42P01" ||
    maybeError.code === "PGRST205" ||
    message.includes(tableName)
  );
}

function isMissingCareSubjectOptionalColumn(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message ?? "";

  return (
    maybeError.code === "42703" ||
    message.includes("account_user_id") ||
    message.includes("avatar_") ||
    message.includes("managed_by_household")
  );
}

async function signedAvatarUrl(
  avatarUrl?: string
) {
  if (!avatarUrl) {
    return undefined;
  }

  if (/^https?:\/\//i.test(avatarUrl)) {
    return avatarUrl;
  }

  let serviceClient: ReturnType<typeof createSupabaseServiceClient>;

  try {
    serviceClient = createSupabaseServiceClient();
  } catch {
    return undefined;
  }

  const { data, error } = await serviceClient.storage
    .from("carepland-avatars")
    .createSignedUrl(avatarUrl, 60 * 60 * 24);

  if (error) {
    return undefined;
  }

  return data.signedUrl;
}
