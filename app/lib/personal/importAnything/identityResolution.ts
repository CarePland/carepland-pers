export type ImportAnythingIdentityCluster = {
  clusterId: string;
  displayName: string;
  entityType: string;
  matchedCareSubjectId: string;
  suggestedNewPersonName: string;
};

export type ImportAnythingIdentityReviewItem = {
  matchedAppointmentId?: string;
  needsReview: boolean;
  ownerCareSubjectId: string;
  ownerClusterId: string;
  ownerDetectedName: string;
  ownerNeedsReview: boolean;
  ownerNewPersonName: string;
  status: "approved" | "needs_review" | "rejected";
  userReviewed?: boolean;
};

export type ImportAnythingDetectedIdentity = {
  clusterId: string;
  displayName: string;
  suggestedNewPersonName: string;
};

export type ImportAnythingIdentityResolutionDecision = {
  action: "create" | "leave_unresolved" | "match";
  clusterId: string;
  createdCareSubjectId?: string;
  matchedCareSubjectId?: string;
};

function normalizedText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isPersonCluster(cluster: ImportAnythingIdentityCluster) {
  const entityType = normalizedText(cluster.entityType);

  return !entityType || entityType === "person" || entityType === "patient";
}

export function importAnythingUnresolvedDetectedIdentities({
  clusters,
  items,
}: {
  clusters: ImportAnythingIdentityCluster[];
  items: ImportAnythingIdentityReviewItem[];
}): ImportAnythingDetectedIdentity[] {
  const itemClusterIds = new Set(
    items.map((item) => item.ownerClusterId).filter(Boolean)
  );
  const knownNames = new Set<string>();
  const unresolved: ImportAnythingDetectedIdentity[] = [];

  for (const cluster of clusters) {
    if (
      !cluster.clusterId ||
      cluster.matchedCareSubjectId ||
      !isPersonCluster(cluster)
    ) {
      continue;
    }

    const displayName =
      cluster.displayName.trim() || cluster.suggestedNewPersonName.trim();

    if (!displayName || !itemClusterIds.has(cluster.clusterId)) {
      continue;
    }

    unresolved.push({
      clusterId: cluster.clusterId,
      displayName,
      suggestedNewPersonName: cluster.suggestedNewPersonName.trim() || displayName,
    });
    knownNames.add(normalizedText(displayName));
  }

  for (const item of items) {
    if (
      item.ownerCareSubjectId ||
      item.ownerClusterId ||
      !item.ownerDetectedName.trim()
    ) {
      continue;
    }

    const key = normalizedText(item.ownerDetectedName);

    if (!key || knownNames.has(key)) {
      continue;
    }

    unresolved.push({
      clusterId: `detected:${key}`,
      displayName: item.ownerDetectedName.trim(),
      suggestedNewPersonName:
        item.ownerNewPersonName.trim() || item.ownerDetectedName.trim(),
    });
    knownNames.add(key);
  }

  return unresolved;
}

export function importAnythingAllIdentitiesResolved({
  clusters,
  items,
}: {
  clusters: ImportAnythingIdentityCluster[];
  items: ImportAnythingIdentityReviewItem[];
}) {
  return (
    importAnythingUnresolvedDetectedIdentities({ clusters, items }).length === 0
  );
}

export function applyImportAnythingIdentityResolutions<
  Item extends ImportAnythingIdentityReviewItem,
>({
  decisions,
  items,
}: {
  decisions: ImportAnythingIdentityResolutionDecision[];
  items: Item[];
}): Item[] {
  const decisionsByClusterId = new Map(
    decisions.map((decision) => [decision.clusterId, decision])
  );

  return items.map((item) => {
    const decision =
      decisionsByClusterId.get(item.ownerClusterId) ??
      decisionsByClusterId.get(`detected:${normalizedText(item.ownerDetectedName)}`);
    const resolvedCareSubjectId =
      decision?.action === "match"
        ? decision.matchedCareSubjectId?.trim() ?? ""
        : decision?.action === "create"
          ? decision.createdCareSubjectId?.trim() ?? ""
          : "";

    if (resolvedCareSubjectId) {
      return {
        ...item,
        needsReview: item.needsReview || item.ownerNeedsReview,
        ownerCareSubjectId: resolvedCareSubjectId,
        ownerNeedsReview: false,
        ownerNewPersonName: "",
      };
    }

    if (decision?.action === "leave_unresolved") {
      return {
        ...item,
        matchedAppointmentId: "",
        needsReview: true,
        ownerCareSubjectId: "",
        ownerNeedsReview: true,
        ownerNewPersonName: "",
        status: item.status === "rejected" ? "rejected" : "needs_review",
        userReviewed: true,
      };
    }

    return item;
  });
}
