import { describe, expect, it } from "vitest";
import { CATEGORY_ORDER } from "@/shared/ui/category-stripe";
import { mockSearchResults } from "./mock-search-results";

describe("mockSearchResults", () => {
  it("returns two or three fake results for every category", () => {
    for (const category of CATEGORY_ORDER) {
      const results = mockSearchResults(category);
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.length).toBeLessThanOrEqual(3);
      for (const result of results) {
        expect(result.title).toMatch(/\S/);
      }
    }
  });
});
