import type {
  AdminUserActivityFilter,
  AdminUserActivityRow,
  AdminUserActivitySortKey,
} from "./AdminUserActivityPanel";

type AdminUserActivitySort = {
  direction: "asc" | "desc";
  key: AdminUserActivitySortKey;
};

export function adminUserActivityStats(rows: AdminUserActivityRow[]) {
  const realUsers = rows.filter((row) => !row.is_test_user);
  const activeSince = Date.now() - 1000 * 60 * 60 * 24 * 14;
  const activeRecently = realUsers.filter(
    (row) =>
      row.last_seen_at && new Date(row.last_seen_at).getTime() >= activeSince
  );
  const needsFollowup = realUsers.filter(
    (row) =>
      row.appointment_count === 0 ||
      (row.appointment_count > 0 && row.note_count === 0) ||
      row.open_support_ticket_count > 0
  );

  return {
    activeRecently: activeRecently.length,
    needsFollowup: needsFollowup.length,
    realUsers: realUsers.length,
    totalUsers: rows.length,
  };
}

export function filterAdminUserActivity({
  filter,
  rows,
  sort,
}: {
  filter: AdminUserActivityFilter;
  rows: AdminUserActivityRow[];
  sort: AdminUserActivitySort;
}) {
  const lastActivityForRow = (row: AdminUserActivityRow) =>
    row.last_support_ticket_at ??
    row.last_careprep_generated_at ??
    row.last_note_created_at ??
    row.last_appointment_created_at ??
    row.last_seen_at;
  const inactiveSince = Date.now() - 1000 * 60 * 60 * 24 * 14;

  const filteredRows = rows.filter((row) => {
    if (filter === "real") {
      return !row.is_test_user;
    }

    if (filter === "test") {
      return row.is_test_user;
    }

    if (filter === "active") {
      return (
        !row.is_test_user &&
        Boolean(row.last_seen_at) &&
        new Date(row.last_seen_at as string).getTime() >= inactiveSince
      );
    }

    if (filter === "inactive") {
      return (
        !row.is_test_user &&
        (!row.last_seen_at || new Date(row.last_seen_at).getTime() < inactiveSince)
      );
    }

    if (filter === "needs_followup") {
      return (
        !row.is_test_user &&
        (row.appointment_count === 0 ||
          (row.appointment_count > 0 && row.note_count === 0) ||
          row.open_support_ticket_count > 0)
      );
    }

    return true;
  });

  return [...filteredRows].sort((firstRow, secondRow) => {
    const direction = sort.direction === "asc" ? 1 : -1;
    const valueForSort = (row: AdminUserActivityRow) => {
      switch (sort.key) {
        case "admin":
          return row.is_admin ? 1 : 0;
        case "appointments":
          return row.appointment_count;
        case "careprep":
          return row.careprep_count;
        case "created":
          return row.account_created_at ?? "";
        case "flags":
          return [row.is_admin ? "Admin" : "", row.is_test_user ? "Test" : ""]
            .filter(Boolean)
            .join(" ");
        case "group":
          return row.user_group ?? "";
        case "last_activity":
          return lastActivityForRow(row) ?? "";
        case "last_seen":
          return row.last_seen_at ?? "";
        case "notes":
          return row.note_count;
        case "tickets":
          return row.open_support_ticket_count;
        case "user":
          return row.display_name || row.email || row.user_id;
        default:
          return "";
      }
    };
    const firstValue = valueForSort(firstRow);
    const secondValue = valueForSort(secondRow);

    if (typeof firstValue === "number" && typeof secondValue === "number") {
      return (firstValue - secondValue) * direction;
    }

    return String(firstValue).localeCompare(String(secondValue)) * direction;
  });
}
