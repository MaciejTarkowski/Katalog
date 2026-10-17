import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { findWikipediaDescription } from "../wikipedia";

type Page = { title: string; index: number; extract?: string; pageprops?: { disambiguation?: string } };

describe("findWikipediaDescription", () => {
  const originalFetch = global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const pages = (list: Page[]) =>
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ query: { pages: list } }) });

  it("searches Polish Wikipedia by the title and returns the matching article's intro with its link", async () => {
    pages([
      { title: "Red Dead Redemption", index: 1, extract: "Red Dead Redemption – gra akcji z 2010 roku wydana przez Rockstar Games." },
      { title: "Red Dead Redemption 2", index: 2, extract: "Red Dead Redemption 2 – przygodowa gra akcji z 2018 roku wydana przez Rockstar Games." },
    ]);

    const result = await findWikipediaDescription({ title: "Red Dead Redemption 2", creator: "Rockstar Games", category: "game" });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.host).toBe("pl.wikipedia.org");
    expect(url.searchParams.get("gsrsearch")).toBe("Red Dead Redemption 2");
    expect(result).toEqual({
      description: "Red Dead Redemption 2 – przygodowa gra akcji z 2018 roku wydana przez Rockstar Games.",
      url: "https://pl.wikipedia.org/wiki/Red_Dead_Redemption_2",
    });
  });

  it("prefers the article whose disambiguation matches the category and skips other kinds", async () => {
    pages([
      { title: "Diuna (film 2021)", index: 1, extract: "Diuna – film w reżyserii Denisa Villeneuve’a na podstawie powieści Franka Herberta." },
      { title: "Diuna", index: 2, extract: "Diuna – strona ujednoznaczniająca.", pageprops: { disambiguation: "" } },
      { title: "Diuna (powieść)", index: 3, extract: "Diuna – powieść fantastycznonaukowa Franka Herberta z 1965 roku." },
    ]);

    const result = await findWikipediaDescription({ title: "Diuna", creator: "Frank Herbert", category: "book" });
    expect(result?.description).toBe("Diuna – powieść fantastycznonaukowa Franka Herberta z 1965 roku.");
    expect(result?.url).toBe("https://pl.wikipedia.org/wiki/Diuna_(powie%C5%9B%C4%87)");
  });

  it("rejects an article with the same title that does not mention the creator", async () => {
    pages([{ title: "Gruby brzuch", index: 1, extract: "Gruby brzuch – potoczna nazwa otyłości brzusznej." }]);
    expect(await findWikipediaDescription({ title: "Gruby Brzuch", creator: "Grubson", category: "music" })).toBeNull();
  });

  it("without a creator, needs the article to be about the right kind of item", async () => {
    pages([
      { title: "Nevermind", index: 1, extract: "Nevermind – słowo w języku angielskim." },
    ]);
    expect(await findWikipediaDescription({ title: "Nevermind", creator: null, category: "music" })).toBeNull();

    pages([{ title: "Nevermind", index: 1, extract: "Nevermind – drugi album studyjny zespołu Nirvana." }]);
    expect((await findWikipediaDescription({ title: "Nevermind", creator: null, category: "music" }))?.description).toContain("album");
  });

  it("shortens a long intro at a sentence end", async () => {
    const sentence = "To jest zdanie opisu powieści Stanisława Lema. ";
    pages([{ title: "Solaris", index: 1, extract: sentence.repeat(30).trim() }]);
    const result = await findWikipediaDescription({ title: "Solaris", creator: "Stanisław Lem", category: "book" });
    expect(result!.description.length).toBeLessThanOrEqual(600);
    expect(result!.description.endsWith(".")).toBe(true);
  });

  it("returns null when Wikipedia has nothing or fails", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ batchcomplete: true }) });
    expect(await findWikipediaDescription({ title: "Szepty spoza nicości", creator: "Remigiusz Mróz", category: "book" })).toBeNull();

    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await findWikipediaDescription({ title: "Solaris", creator: "Stanisław Lem", category: "book" })).toBeNull();
  });
});
