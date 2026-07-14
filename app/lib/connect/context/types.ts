export type ConnectPersPerson = {
  avatarAltText?: string;
  avatarEmoji?: string;
  avatarType?: "generated" | "initials" | "uploaded";
  avatarUrl?: string;
  careCircleId: string;
  displayName: string;
  id: string;
  isActive?: boolean;
  isDefault?: boolean;
  managedByHousehold?: boolean;
  subjectType?: string;
};

export type ConnectMainUserContext = {
  mainConnectUserPerson: ConnectPersPerson | null;
  mainConnectUserPersonId: string | null;
  people: ConnectPersPerson[];
  primaryCoordinator?: {
    displayName: string;
    source: "care_circle_owner" | "fallback";
    userId?: string;
  };
  source: "local_dev" | "supabase" | "unset";
};

export type UpdateConnectMainUserContextInput = {
  mainConnectUserPersonId: string;
};
