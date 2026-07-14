import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyImportAnythingIdentityResolutions,
  importAnythingAllIdentitiesResolved,
  importAnythingUnresolvedDetectedIdentities,
  type ImportAnythingIdentityCluster,
  type ImportAnythingIdentityReviewItem,
} from "./identityResolution";

function item(
  overrides: Partial<ImportAnythingIdentityReviewItem>
): ImportAnythingIdentityReviewItem {
  return {
    matchedAppointmentId: "",
    needsReview: false,
    ownerCareSubjectId: "",
    ownerClusterId: "",
    ownerDetectedName: "",
    ownerNeedsReview: false,
    ownerNewPersonName: "",
    status: "approved",
    ...overrides,
  };
}

function cluster(
  overrides: Partial<ImportAnythingIdentityCluster>
): ImportAnythingIdentityCluster {
  return {
    clusterId: "",
    displayName: "",
    entityType: "person",
    matchedCareSubjectId: "",
    suggestedNewPersonName: "",
    ...overrides,
  };
}

describe("Import Anything identity resolution", () => {
  it("reports all people resolved so Review can open immediately", () => {
    const clusters = [
      cluster({
        clusterId: "cluster_rob",
        displayName: "Rob Robson",
        matchedCareSubjectId: "rob",
      }),
    ];
    const items = [
      item({
        ownerCareSubjectId: "rob",
        ownerClusterId: "cluster_rob",
        ownerDetectedName: "Rob Robson",
      }),
    ];

    assert.equal(importAnythingAllIdentitiesResolved({ clusters, items }), true);
    assert.deepEqual(
      importAnythingUnresolvedDetectedIdentities({ clusters, items }),
      []
    );
  });

  it("finds one unknown person before object review", () => {
    const clusters = [
      cluster({
        clusterId: "cluster_elizabeth",
        displayName: "Elizabeth L. Goodloe",
        suggestedNewPersonName: "Elizabeth L. Goodloe",
      }),
    ];
    const items = [
      item({
        ownerClusterId: "cluster_elizabeth",
        ownerDetectedName: "Elizabeth L. Goodloe",
      }),
    ];

    assert.equal(importAnythingAllIdentitiesResolved({ clusters, items }), false);
    assert.deepEqual(importAnythingUnresolvedDetectedIdentities({ clusters, items }), [
      {
        clusterId: "cluster_elizabeth",
        displayName: "Elizabeth L. Goodloe",
        suggestedNewPersonName: "Elizabeth L. Goodloe",
      },
    ]);
  });

  it("requires multiple unknown people to be resolved independently", () => {
    const clusters = [
      cluster({ clusterId: "cluster_elizabeth", displayName: "Elizabeth" }),
      cluster({ clusterId: "cluster_bob", displayName: "Bob" }),
    ];
    const items = [
      item({ ownerClusterId: "cluster_elizabeth", ownerDetectedName: "Elizabeth" }),
      item({ ownerClusterId: "cluster_bob", ownerDetectedName: "Bob" }),
    ];

    assert.deepEqual(
      importAnythingUnresolvedDetectedIdentities({ clusters, items }).map(
        (identity) => identity.displayName
      ),
      ["Elizabeth", "Bob"]
    );
  });

  it("matched person flows into downstream review items", () => {
    const [resolved] = applyImportAnythingIdentityResolutions({
      decisions: [
        {
          action: "match",
          clusterId: "cluster_elizabeth",
          matchedCareSubjectId: "ellie",
        },
      ],
      items: [
        item({
          ownerClusterId: "cluster_elizabeth",
          ownerDetectedName: "Elizabeth L. Goodloe",
          ownerNeedsReview: true,
          status: "needs_review",
        }),
      ],
    });

    assert.equal(resolved?.ownerCareSubjectId, "ellie");
    assert.equal(resolved?.ownerNewPersonName, "");
    assert.equal(resolved?.ownerNeedsReview, false);
  });

  it("created person resolves ownership before downstream appointment creation", () => {
    const [resolved] = applyImportAnythingIdentityResolutions({
      decisions: [
        {
          action: "create",
          clusterId: "cluster_elizabeth",
          createdCareSubjectId: "new-ellie",
        },
      ],
      items: [
        item({
          ownerClusterId: "cluster_elizabeth",
          ownerDetectedName: "Elizabeth L. Goodloe",
          ownerNewPersonName: "Elizabeth L. Goodloe",
        }),
      ],
    });

    assert.equal(resolved?.ownerCareSubjectId, "new-ellie");
    assert.equal(resolved?.ownerNewPersonName, "");
  });

  it("matched person resolves ownership when only a detected name is available", () => {
    const [resolved] = applyImportAnythingIdentityResolutions({
      decisions: [
        {
          action: "match",
          clusterId: "detected:elizabeth l. goodloe",
          matchedCareSubjectId: "ellie",
        },
      ],
      items: [
        item({
          ownerDetectedName: "Elizabeth L. Goodloe",
          status: "needs_review",
        }),
      ],
    });

    assert.equal(resolved?.ownerCareSubjectId, "ellie");
    assert.equal(resolved?.ownerNewPersonName, "");
  });

  it("unresolved person remains unresolved through review", () => {
    const [resolved] = applyImportAnythingIdentityResolutions({
      decisions: [
        {
          action: "leave_unresolved",
          clusterId: "cluster_elizabeth",
        },
      ],
      items: [
        item({
          matchedAppointmentId: "appt-1",
          ownerClusterId: "cluster_elizabeth",
          ownerDetectedName: "Elizabeth L. Goodloe",
          ownerNewPersonName: "Elizabeth L. Goodloe",
        }),
      ],
    });

    assert.equal(resolved?.ownerCareSubjectId, "");
    assert.equal(resolved?.ownerNewPersonName, "");
    assert.equal(resolved?.matchedAppointmentId, "");
    assert.equal(resolved?.needsReview, true);
    assert.equal(resolved?.status, "needs_review");
  });

  it("does not silently substitute an existing Care VIP by matching names", () => {
    const [unresolved] = applyImportAnythingIdentityResolutions({
      decisions: [],
      items: [
        item({
          ownerClusterId: "cluster_rob",
          ownerDetectedName: "Rob Robson",
          ownerNewPersonName: "Rob Robson",
        }),
      ],
    });

    assert.equal(unresolved?.ownerCareSubjectId, "");
    assert.equal(unresolved?.ownerNewPersonName, "Rob Robson");
  });
});
