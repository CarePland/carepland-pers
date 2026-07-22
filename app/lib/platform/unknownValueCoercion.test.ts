import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  arrayFromUnknown,
  numberFromUnknown,
  stringFromUnknown,
} from "./unknownValueCoercion";

describe("stringFromUnknown", () => {
  it("returns an empty string for null or undefined", () => {
    assert.equal(stringFromUnknown(null), "");
    assert.equal(stringFromUnknown(undefined), "");
  });

  it("stringifies non-array values", () => {
    assert.equal(stringFromUnknown("hello"), "hello");
    assert.equal(stringFromUnknown(42), "42");
    assert.equal(stringFromUnknown(true), "true");
  });

  it("joins array values on newlines, dropping empty entries", () => {
    assert.equal(stringFromUnknown(["a", "", "b"]), "a\nb");
  });
});

describe("numberFromUnknown", () => {
  it("passes numbers through unchanged", () => {
    assert.equal(numberFromUnknown(3.5), 3.5);
  });

  it("coerces numeric strings and falls back to 0 otherwise", () => {
    assert.equal(numberFromUnknown("7"), 7);
    assert.equal(numberFromUnknown("not a number"), 0);
    assert.equal(numberFromUnknown(null), 0);
  });
});

describe("arrayFromUnknown", () => {
  it("keeps only plain object entries from an array", () => {
    assert.deepEqual(arrayFromUnknown([{ a: 1 }, "skip", null, { b: 2 }, [1, 2]]), [
      { a: 1 },
      { b: 2 },
    ]);
  });

  it("returns an empty array for non-array input", () => {
    assert.deepEqual(arrayFromUnknown("not an array"), []);
    assert.deepEqual(arrayFromUnknown(null), []);
  });
});
