import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildWhatToKnowDisplayModel, mergeWhatToKnowCategoryItems } from "./whatToKnow";

describe("What to Know display model", () => {
  it("builds What to Know from communication items even without CarePrep", () => {
    const model = buildWhatToKnowDisplayModel({
      communicationItems: [
        {
          category: "bring_list",
          createdAt: "2026-07-13T12:00:00.000Z",
          id: "bring-insulin",
          sourceDisplayNames: ["Rob"],
          sourceMessageIds: ["message-1"],
          sourceType: "communication",
          status: "active",
          text: "Bring insulin.",
          updatedAt: "2026-07-13T12:00:00.000Z",
        },
      ],
    });

    assert.equal(model.hasItems, true);
    assert.deepEqual(model.categories.bring_list, [
      {
        key: "communication:bring-insulin",
        sourceLabel: "Rob",
        sourceTypes: ["communication"],
        text: "Bring insulin.",
      },
    ]);
  });

  it("merges duplicate CarePrep and communication display items conservatively", () => {
    const display = mergeWhatToKnowCategoryItems({
      carePrepItems: ["Bring medication list."],
      communicationItems: [
        {
          category: "bring_list",
          createdAt: "2026-07-13T12:00:00.000Z",
          id: "bring-current-medication-list",
          sourceDisplayNames: ["Rob"],
          sourceMessageIds: ["message-1"],
          sourceType: "communication",
          status: "active",
          text: "Bring the current medication list.",
          updatedAt: "2026-07-13T12:00:00.000Z",
        },
      ],
    });

    assert.equal(display.length, 1);
    assert.deepEqual(display[0]?.sourceTypes, ["careprep", "communication"]);
    assert.equal(display[0]?.sourceLabel, "Rob");
  });

  it("uses et al when multiple communication sources contributed", () => {
    const display = mergeWhatToKnowCategoryItems({
      carePrepItems: [],
      communicationItems: [
        {
          category: "bring_list",
          createdAt: "2026-07-13T12:00:00.000Z",
          id: "bring-glasses",
          sourceDisplayNames: ["Rob", "Andrew"],
          sourceMessageIds: ["message-1", "message-2"],
          sourceType: "communication",
          status: "active",
          text: "Bring glasses.",
          updatedAt: "2026-07-13T12:00:00.000Z",
        },
      ],
    });

    assert.equal(display[0]?.sourceLabel, "Rob et al");
  });
});
