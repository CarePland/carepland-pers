import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createSupabaseServiceClient,
  createSupabaseUserClient,
} from "@/app/lib/platform/server/supabase";
import { connectAvatarAltText } from "../../avatar";
import {
  uniqueConnectParticipantPersonIds,
} from "../connectParticipantFiltering";
import {
  isConnectPetSubjectType,
  isEligibleMainConnectUserPerson,
} from "../mainConnectUserEligibility";
import type { ConnectMainUserContext, ConnectPersPerson } from "../types";

type LocalConnectSettings = {
  main_connect_user_person_id: string | null;
  updated_at: string;
  version: 1;
};

type CareSubjectRow = {
  avatar_alt_text?: string | null;
  avatar_type?: "generated" | "initials" | "uploaded" | null;
  avatar_url?: string | null;
  care_circle_id: string;
  display_name: string | null;
  id: string;
  is_active: boolean | null;
  is_default: boolean | null;
  subject_type: string | null;
};

type CareCircleMembershipRow = {
  care_circle_id: string;
};

type ConnectSettingsRow = {
  main_connect_user_person_id: string | null;
};

type ConnectParticipantRow = {
  person_id: string | null;
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

  if (!isEligibleMainConnectUserPerson(person)) {
    throw new ConnectPersonAccessDeniedError();
  }

  return {
    accessToken,
    mainConnectUserPersonId: normalizedPersonId,
    userContext,
  };
}

export async function readConnectMainUserContext(
  userContext: ConnectUserContext
): Promise<ConnectMainUserContext> {
  const settingsPath = connectSettingsPathForUser(userContext.userId);
  const [settingsResult, people] = await Promise.all([
    readConnectSettings(userContext, settingsPath),
    listPersPeopleForConnect(userContext),
  ]);
  const { settings, source } = settingsResult;
  const mainConnectUserPerson =
    people.find(
      (person) =>
        person.id === settings.main_connect_user_person_id &&
        isEligibleMainConnectUserPerson(person)
    ) ?? null;

  return {
    mainConnectUserPerson,
    mainConnectUserPersonId: mainConnectUserPerson?.id ?? null,
    people,
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
    mainConnectUserPerson: person,
    mainConnectUserPersonId: person.id,
    people,
    source,
  } satisfies ConnectMainUserContext;
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

export async function createConnectUserContext(accessToken: string) {
  if (!accessToken) {
    throw new Error("Please sign in before loading Connect people.");
  }

  const supabase = createSupabaseUserClient(accessToken);
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  const userId = userData.user?.id;

  if (!userId) {
    throw new Error("Please sign in before loading Connect people.");
  }

  return { accessToken, userId } satisfies ConnectUserContext;
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
  const supabase = createSupabaseUserClient(userContext.accessToken);
  const { data: memberships, error: membershipsError } = await supabase
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

  const participantPersonIds = await listConnectParticipantPersonIds(
    supabase,
    careCircleIds
  );

  let careSubjectsQuery = supabase
    .from("care_subjects")
    .select("id,care_circle_id,display_name,subject_type,is_default,is_active,avatar_url,avatar_type,avatar_alt_text")
    .in("care_circle_id", careCircleIds)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("display_name", { ascending: true });

  if (participantPersonIds.length > 0) {
    careSubjectsQuery = careSubjectsQuery.in("id", participantPersonIds);
  }

  const careSubjectsResult = await careSubjectsQuery;
  let data = careSubjectsResult.data as CareSubjectRow[] | null;
  const error = careSubjectsResult.error;

  if (error) {
    if (!isMissingAvatarColumn(error)) {
      throw error;
    }

    let fallbackQuery = supabase
      .from("care_subjects")
      .select("id,care_circle_id,display_name,subject_type,is_default,is_active")
      .in("care_circle_id", careCircleIds)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("display_name", { ascending: true });

    if (participantPersonIds.length > 0) {
      fallbackQuery = fallbackQuery.in("id", participantPersonIds);
    }

    const fallbackResult = await fallbackQuery;

    if (fallbackResult.error) {
      throw fallbackResult.error;
    }

    data = (fallbackResult.data ?? []).map((row) => ({
      ...row,
      avatar_alt_text: null,
      avatar_type: null,
      avatar_url: null,
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
      isDefault: row.is_default === true,
      subjectType: row.subject_type ?? undefined,
    }));

  return Promise.all(
    people.map(async (person) => ({
      ...person,
      avatarAltText: person.avatarAltText ?? connectAvatarAltText(person),
      avatarUrl: await signedAvatarUrl(person.avatarUrl),
    }))
  );
}

export async function listPersFocusPeopleForConnect(
  userContext: ConnectUserContext
): Promise<ConnectPersPerson[]> {
  const supabase = createSupabaseUserClient(userContext.accessToken);
  const { data: memberships, error: membershipsError } = await supabase
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

  const careSubjectsQuery = supabase
    .from("care_subjects")
    .select("id,care_circle_id,display_name,subject_type,is_default,is_active,avatar_url,avatar_type,avatar_alt_text")
    .in("care_circle_id", careCircleIds)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("display_name", { ascending: true });

  const careSubjectsResult = await careSubjectsQuery;
  let data = careSubjectsResult.data as CareSubjectRow[] | null;
  const error = careSubjectsResult.error;

  if (error) {
    if (!isMissingAvatarColumn(error)) {
      throw error;
    }

    const fallbackResult = await supabase
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
      isDefault: row.is_default === true,
      subjectType: row.subject_type ?? undefined,
    }));

  return Promise.all(
    people.map(async (person) => ({
      ...person,
      avatarAltText: person.avatarAltText ?? connectAvatarAltText(person),
      avatarUrl: await signedAvatarUrl(person.avatarUrl),
    }))
  );
}

async function listConnectParticipantPersonIds(
  supabase: ReturnType<typeof createSupabaseUserClient>,
  careCircleIds: string[]
) {
  const { data, error } = await supabase
    .from("connect_participants")
    .select("person_id")
    .in("care_circle_id", careCircleIds)
    .eq("status", "active");

  if (!error) {
    return uniqueConnectParticipantPersonIds(
      (data ?? []) as ConnectParticipantRow[]
    );
  }

  if (isMissingConnectParticipantsTable(error)) {
    return [];
  }

  throw error;
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
  return path.join(
    process.cwd(),
    "tmp",
    "connect-settings",
    `${userId}-main-connect-user.json`
  );
}

function isMissingConnectSettingsTable(error: unknown) {
  return isMissingTable(error, "connect_settings");
}

function isMissingConnectParticipantsTable(error: unknown) {
  return isMissingTable(error, "connect_participants");
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

function isMissingAvatarColumn(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message ?? "";

  return maybeError.code === "42703" || message.includes("avatar_");
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
