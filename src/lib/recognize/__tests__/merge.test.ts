import { describe, it, expect } from "vitest";
import { mergeRecognition } from "../merge";

describe("mergeRecognition", () => {
  it("keeps the catalog cover when the cover shows a roman numeral", () => {
    const merged = mergeRecognition(
      { title: "Red Dead Redemption II", creator: null, category: "game", subcategory: "PS4" },
      {
        title: "Red Dead Redemption 2",
        artist_creator: "Rockstar Games",
        category: "game",
        subcategory: null,
        cover_url: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1q1f.jpg",
        metadata: { source: "rawg" },
        source: "rawg",
      }
    );
    expect(merged.title).toBe("Red Dead Redemption II");
    expect(merged.cover_url).toBe("https://images.igdb.com/igdb/image/upload/t_cover_big/co1q1f.jpg");
  });
});
