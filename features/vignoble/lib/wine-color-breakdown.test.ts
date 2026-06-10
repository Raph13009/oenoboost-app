import { describe, expect, it } from "vitest";

import { getWineColorBreakdown } from "./wine-color-breakdown";

describe("getWineColorBreakdown", () => {
  it("returns null when all columns are null", () => {
    expect(
      getWineColorBreakdown({
        wine_pct_red: null,
        wine_pct_rose: null,
        wine_pct_white: null,
        wine_pct_sparkling: null,
        wine_pct_liqueur: null,
      }),
    ).toBeNull();
  });

  it("returns null when all values sum to zero", () => {
    expect(
      getWineColorBreakdown({
        wine_pct_red: 0,
        wine_pct_rose: 0,
        wine_pct_white: 0,
        wine_pct_sparkling: 0,
        wine_pct_liqueur: 0,
      }),
    ).toBeNull();
  });

  it("returns breakdown when data is present", () => {
    expect(
      getWineColorBreakdown({
        wine_pct_red: 60,
        wine_pct_rose: 10,
        wine_pct_white: 25,
        wine_pct_sparkling: 5,
        wine_pct_liqueur: 0,
      }),
    ).toEqual({
      red: 60,
      rose: 10,
      white: 25,
      sparkling: 5,
      liqueur: 0,
    });
  });

  it("treats a missing rosé share as zero", () => {
    expect(
      getWineColorBreakdown({
        wine_pct_red: 70,
        wine_pct_rose: null,
        wine_pct_white: 30,
        wine_pct_sparkling: null,
        wine_pct_liqueur: null,
      }),
    ).toEqual({
      red: 70,
      rose: 0,
      white: 30,
      sparkling: 0,
      liqueur: 0,
    });
  });
});
