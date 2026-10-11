import { describe, expect, it } from "vitest";
import { withoutOverrides } from "../form-overrides";

describe("withoutOverrides", () => {
  it("drops fields an effect changes, keeping the rest", () => {
    const submitted = { "system.scores.str.value": 12, "system.details.title": "Veteran" };
    expect(withoutOverrides(submitted, ["system.scores.str.value", "system.hp.max"])).toEqual({
      "system.details.title": "Veteran",
    });
  });
});
