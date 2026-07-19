import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  receiverLayoutOptions,
  receiverLayoutOptionUrl,
} from "./receiverLayoutCatalog";

describe("Receiver layout catalog", () => {
  it("keeps only approved layouts active and assignable", () => {
    const activeLayouts = receiverLayoutOptions.filter(
      (layout) => layout.stage === "active"
    );

    assert.deepEqual(
      activeLayouts.map((layout) => layout.label),
      ["Appliance", "Modern"]
    );
    assert.equal(activeLayouts.every((layout) => layout.productionReady), true);
    assert.equal(activeLayouts.every((layout) => layout.assignable), true);
    assert.equal(activeLayouts.every((layout) => layout.customerVisible), true);
  });

  it("builds a Modern preview URL from the approved responsive web layout", () => {
    const modernLayout = receiverLayoutOptions.find(
      (layout) => layout.id === "modern"
    );

    assert.ok(modernLayout);
    assert.equal(modernLayout.stage, "active");
    assert.equal(modernLayout.receiverLayout, "modern");
    assert.match(receiverLayoutOptionUrl(modernLayout), /receiverLayout=modern/);
    assert.match(receiverLayoutOptionUrl(modernLayout), /uiLayout=default_receiver/);
  });
});
