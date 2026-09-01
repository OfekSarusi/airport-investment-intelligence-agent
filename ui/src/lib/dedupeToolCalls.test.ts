import { describe, expect, it } from "vitest";
import { shouldRenderCard } from "./dedupeToolCalls";
import type { ToolCall } from "../types";

function call(name: ToolCall["name"], iata?: string): ToolCall {
  return { name, args: iata ? { iata_code: iata } : {}, result: {}, isError: false };
}

describe("shouldRenderCard", () => {
  it("renders only the first of two identical calls for the same airport", () => {
    const calls = [call("get_airport_details", "SFO"), call("get_airport_details", "SFO")];
    expect(shouldRenderCard(calls[0], calls, 0)).toBe(true);
    expect(shouldRenderCard(calls[1], calls, 1)).toBe(false);
  });

  it("hides get_unmet_demand_analysis when get_airport_details already covered that airport (the real SFO bug)", () => {
    const calls = [call("get_airport_details", "SFO"), call("get_unmet_demand_analysis", "SFO")];
    expect(shouldRenderCard(calls[0], calls, 0)).toBe(true);
    expect(shouldRenderCard(calls[1], calls, 1)).toBe(false);
  });

  it("renders both when the calls are for different airports", () => {
    const calls = [call("get_airport_details", "SFO"), call("get_unmet_demand_analysis", "ANC")];
    expect(shouldRenderCard(calls[0], calls, 0)).toBe(true);
    expect(shouldRenderCard(calls[1], calls, 1)).toBe(true);
  });
});
