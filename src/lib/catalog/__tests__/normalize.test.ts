import { describe, it, expect } from "vitest";
import {
  extractEanFromText,
  extractIsbnFromText,
  isIsbnPrefix,
  normalizeEan,
  cleanSearchQuery,
} from "../normalize";

describe("catalog normalize", () => {
  it("normalizes EAN-13 and UPC codes", () => {
    expect(normalizeEan("978-0-261-10221-7")).toBe("9780261102217");
    expect(normalizeEan("012345678905")).toBe("012345678905");
    expect(normalizeEan("not-a-code")).toBeNull();
  });

  it("detects ISBN prefixes", () => {
    expect(isIsbnPrefix("9780261102217")).toBe(true);
    expect(isIsbnPrefix("5901234123457")).toBe(false);
  });

  it("extracts ISBN from OCR-like text", () => {
    const text = "The Hobbit\nJ.R.R. Tolkien\nISBN 978-0-261-10221-7";
    expect(extractIsbnFromText(text)).toBe("9780261102217");
  });

  it("extracts standalone EAN from text", () => {
    expect(extractEanFromText("kod 724381234567")).toBe("724381234567");
  });

  it("cleans OCR query noise", () => {
    expect(cleanSearchQuery("  Pink   Floyd | Dark Side  ")).toBe(
      "Pink Floyd Dark Side"
    );
  });
});
