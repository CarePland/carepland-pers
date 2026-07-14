import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  connectCallsDeprecated,
  connectPollingDailyInvocationEstimate,
  connectPollingIntervals,
  connectPollingIntervalMs,
  connectReceiverGuideDeprecated,
} from "./pollingPolicy";

describe("Connect Receiver polling policy", () => {
  it("keeps deprecated call and receiver guide polling disabled", () => {
    assert.equal(connectCallsDeprecated, true);
    assert.equal(connectReceiverGuideDeprecated, true);
  });

  it("stops polling when prerequisites are absent", () => {
    assert.equal(
      connectPollingIntervalMs({
        intervalMs: connectPollingIntervals.receiverMessagesMs,
        prerequisitesMet: false,
      }),
      null
    );
  });

  it("slows polling while the document is hidden", () => {
    assert.equal(
      connectPollingIntervalMs({
        hidden: true,
        intervalMs: connectPollingIntervals.receiverMessagesMs,
        prerequisitesMet: true,
      }),
      connectPollingIntervals.hiddenMs
    );
  });

  it("uses visible intervals when the document is active", () => {
    assert.equal(
      connectPollingIntervalMs({
        hidden: false,
        intervalMs: connectPollingIntervals.receiverMessagesMs,
        prerequisitesMet: true,
      }),
      connectPollingIntervals.receiverMessagesMs
    );
  });

  it("calculates daily invocation volume for recurring request inventory", () => {
    assert.equal(
      connectPollingDailyInvocationEstimate({
        intervalSeconds: 1,
        pollers: 2,
        openClients: 1,
      }),
      172_800
    );
    assert.equal(
      connectPollingDailyInvocationEstimate({
        intervalSeconds: 2.5,
        openClients: 2,
      }),
      69_120
    );
  });
});

