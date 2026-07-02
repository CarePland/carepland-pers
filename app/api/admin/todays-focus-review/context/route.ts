import { NextResponse } from "next/server";

import {
  createSupabaseServiceClient,
  createSupabaseUserClient,
} from "@/app/lib/platform/server/supabase";

type RecommendationCountRow = {
  care_subject_id: string;
};

type AdminUserActivityCareSubject = {
  care_circle_id?: string | null;
  display_name?: string | null;
  id: string;
  is_active?: boolean | null;
  subject_type?: string | null;
};

type AdminUserActivityRow = {
  care_subjects?: AdminUserActivityCareSubject[] | null;
  display_name?: string | null;
  email?: string | null;
  user_id: string;
};

const GLOBAL_CARE_VIP_GROUP_ID = "all-care-vips";

export async function GET(request: Request) {
  try {
    const accessToken = (request.headers.get("authorization") ?? "")
      .replace(/^Bearer\s+/i, "")
      .trim();

    if (!accessToken) {
      throw new Error("Please sign in before loading Today's Focus groups.");
    }

    const userClient = createSupabaseUserClient(accessToken);
    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError) {
      throw userError;
    }

    const adminUserId = userData.user?.id;

    if (!adminUserId) {
      throw new Error("Please sign in before loading Today's Focus groups.");
    }

    const { data: adminProfile, error: adminProfileError } = await userClient
      .from("profiles")
      .select("is_admin")
      .eq("id", adminUserId)
      .single();

    if (adminProfileError) {
      throw adminProfileError;
    }

    if (adminProfile?.is_admin !== true) {
      throw new Error("Admin access is required to load Today's Focus groups.");
    }

    const adminClient = createSupabaseServiceClient();
    const { data: activityRows, error: activityError } = await userClient.rpc(
      "get_admin_user_activity_summary"
    );

    if (activityError) {
      throw activityError;
    }

    const adminUserActivityRows = (activityRows ?? []) as AdminUserActivityRow[];
    const subjects = uniqueActivitySubjects(adminUserActivityRows);
    const unreviewedCountsBySubjectId = await loadUnreviewedCountsBySubjectId(
      adminClient,
      subjects.map((subject) => subject.id)
    );
    const allSubjectsWithCounts = subjects.map((subject) => ({
      careCircleId: activitySubjectGroupId(subject),
      displayName: subject.display_name?.trim() || "Unnamed Care VIP",
      id: subject.id,
      isDefault: false,
      subjectType: subject.subject_type ?? "person",
      unreviewedCount: unreviewedCountsBySubjectId.get(subject.id) ?? 0,
    }));
    const groups = buildGroupsFromActivityRows(
      adminUserActivityRows,
      unreviewedCountsBySubjectId
    );
    const globalGroup = {
      careCircleId: GLOBAL_CARE_VIP_GROUP_ID,
      createdAt: null,
      label: "All Care VIPs",
      memberUserIds: [],
      ownerLabel: null,
      ownerUserId: null,
      subjects: allSubjectsWithCounts,
      unreviewedCount: allSubjectsWithCounts.reduce(
        (total, subject) => total + subject.unreviewedCount,
        0
      ),
    };
    const accounts = adminUserActivityRows
      .map((row) => {
        const activityCareSubjects = Array.isArray(row.care_subjects)
          ? row.care_subjects
          : [];
        const activityGroupIds = new Set(
          activityCareSubjects
            .map(activitySubjectGroupId)
            .filter((value) => value.length > 0)
        );
        const profileGroups = groups.filter((group) => {
          return activityGroupIds.has(group.careCircleId);
        });

        return {
          email: row.email ?? null,
          groupIds: profileGroups.map((group) => group.careCircleId),
          id: row.user_id,
          label:
            row.display_name?.trim() ||
            row.email?.trim() ||
            `User ${row.user_id.slice(0, 8)}`,
          subjectCount: profileGroups.reduce(
            (total, group) => total + group.subjects.length,
            0
          ),
          unreviewedCount: profileGroups.reduce(
            (total, group) => total + (group.unreviewedCount ?? 0),
            0
          ),
        };
      })
      .sort((left, right) => {
        const countDelta = right.unreviewedCount - left.unreviewedCount;
        return countDelta || left.label.localeCompare(right.label);
      });

    return NextResponse.json({
      accounts,
      groups: allSubjectsWithCounts.length > 0 ? [globalGroup, ...groups] : groups,
      ok: true,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("Today's Focus admin context failed.", error);

    return NextResponse.json(
      {
        error: message || "Today's Focus groups could not be loaded.",
        accounts: [],
        groups: [],
        ok: false,
      },
      { status: 500 }
    );
  }
}

async function loadUnreviewedCountsBySubjectId(
  adminClient: ReturnType<typeof createSupabaseServiceClient>,
  subjectIds: string[]
) {
  if (subjectIds.length === 0) {
    return new Map<string, number>();
  }

  const { data, error } = await adminClient
    .from("care_recommendations")
    .select("care_subject_id")
    .in("care_subject_id", subjectIds)
    .in("status", ["candidate", "approved"]);

  if (error) {
    if (isOptionalRecommendationStorageUnavailable(error)) {
      return new Map<string, number>();
    }

    throw error;
  }

  return ((data ?? []) as RecommendationCountRow[]).reduce<Map<string, number>>(
    (counts, row) => {
      counts.set(row.care_subject_id, (counts.get(row.care_subject_id) ?? 0) + 1);
      return counts;
    },
    new Map()
  );
}

function uniqueActivitySubjects(rows: AdminUserActivityRow[]) {
  const subjectsById = new Map<string, AdminUserActivityCareSubject>();

  rows.forEach((row) => {
    const subjects = Array.isArray(row.care_subjects) ? row.care_subjects : [];
    subjects.forEach((subject) => {
      if (!subject.id || subject.is_active === false) {
        return;
      }

      subjectsById.set(subject.id, subject);
    });
  });

  return Array.from(subjectsById.values()).sort((left, right) =>
    (left.display_name ?? left.id).localeCompare(right.display_name ?? right.id)
  );
}

function buildGroupsFromActivityRows(
  rows: AdminUserActivityRow[],
  unreviewedCountsBySubjectId: Map<string, number>
) {
  const groupsById = new Map<
    string,
    {
      careCircleId: string;
      createdAt: null;
      label: string;
      memberUserIds: string[];
      ownerLabel: string | null;
      ownerUserId: string | null;
      subjects: Array<{
        careCircleId: string;
        displayName: string;
        id: string;
        isDefault: boolean;
        subjectType: string;
        unreviewedCount: number;
      }>;
      unreviewedCount: number;
    }
  >();

  rows.forEach((row) => {
    const rowLabel =
      row.display_name?.trim() ||
      row.email?.trim() ||
      `User ${row.user_id.slice(0, 8)}`;
    const subjects = Array.isArray(row.care_subjects) ? row.care_subjects : [];

    subjects.forEach((subject) => {
      if (!subject.id || subject.is_active === false) {
        return;
      }

      const careCircleId = activitySubjectGroupId(subject);
      const group =
        groupsById.get(careCircleId) ??
        {
          careCircleId,
          createdAt: null,
          label: `${rowLabel} Care VIPs`,
          memberUserIds: [],
          ownerLabel: rowLabel,
          ownerUserId: row.user_id,
          subjects: [],
          unreviewedCount: 0,
        };

      if (!group.memberUserIds.includes(row.user_id)) {
        group.memberUserIds.push(row.user_id);
      }

      if (!group.subjects.some((existing) => existing.id === subject.id)) {
        const unreviewedCount = unreviewedCountsBySubjectId.get(subject.id) ?? 0;
        group.subjects.push({
          careCircleId,
          displayName: subject.display_name?.trim() || "Unnamed Care VIP",
          id: subject.id,
          isDefault: false,
          subjectType: subject.subject_type ?? "person",
          unreviewedCount,
        });
        group.unreviewedCount += unreviewedCount;
      }

      groupsById.set(careCircleId, group);
    });
  });

  return Array.from(groupsById.values())
    .map((group) => ({
      ...group,
      subjects: group.subjects.sort((left, right) =>
        left.displayName.localeCompare(right.displayName)
      ),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function activitySubjectGroupId(subject: AdminUserActivityCareSubject) {
  return subject.care_circle_id?.trim() || `subject-${subject.id}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (!error || typeof error !== "object") {
    return "";
  }

  const maybeError = error as {
    details?: string;
    hint?: string;
    message?: string;
  };

  return [maybeError.message, maybeError.details, maybeError.hint]
    .filter(Boolean)
    .join(" ");
}

function isOptionalRecommendationStorageUnavailable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message ?? "";

  return (
    maybeError.code === "42P01" ||
    maybeError.code === "42703" ||
    maybeError.code === "PGRST205" ||
    message.includes("permission denied") ||
    message.includes("care_recommendations")
  );
}
