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

    const result = await findWikipediaDescription({ title: "Red Dead Redemption 2", creator: "Rockstar Games", category: "game" }, "pl");

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

    const result = await findWikipediaDescription({ title: "Diuna", creator: "Frank Herbert", category: "book" }, "pl");
    expect(result?.description).toBe("Diuna – powieść fantastycznonaukowa Franka Herberta z 1965 roku.");
    expect(result?.url).toBe("https://pl.wikipedia.org/wiki/Diuna_(powie%C5%9B%C4%87)");
  });

  it("rejects an article with the same title that does not mention the creator", async () => {
    pages([{ title: "Gruby brzuch", index: 1, extract: "Gruby brzuch – potoczna nazwa otyłości brzusznej." }]);
    expect(await findWikipediaDescription({ title: "Gruby Brzuch", creator: "Grubson", category: "music" }, "pl")).toBeNull();
  });

  it("without a creator, needs the article to be about the right kind of item", async () => {
    pages([
      { title: "Nevermind", index: 1, extract: "Nevermind – słowo w języku angielskim." },
    ]);
    expect(await findWikipediaDescription({ title: "Nevermind", creator: null, category: "music" }, "pl")).toBeNull();

    pages([{ title: "Nevermind", index: 1, extract: "Nevermind – drugi album studyjny zespołu Nirvana." }]);
    expect((await findWikipediaDescription({ title: "Nevermind", creator: null, category: "music" }, "pl"))?.description).toContain("album");
  });

  it("shortens a long intro at a sentence end", async () => {
    const sentence = "To jest zdanie opisu powieści Stanisława Lema. ";
    pages([{ title: "Solaris", index: 1, extract: sentence.repeat(30).trim() }]);
    const result = await findWikipediaDescription({ title: "Solaris", creator: "Stanisław Lem", category: "book" }, "pl");
    expect(result!.description.length).toBeLessThanOrEqual(600);
    expect(result!.description.endsWith(".")).toBe(true);
  });

  it("falls back to English Wikipedia when there is no Polish article", async () => {
    fetchMock.mockImplementation(async (href: string) => {
      const list: Page[] = href.includes("pl.wikipedia.org")
        ? [{ title: "Nintendo Switch", index: 1, extract: "Nintendo Switch – konsola gier wideo wyprodukowana przez Nintendo." }]
        : [
            { title: "Nintendo Switch", index: 1, extract: "The Nintendo Switch is a video game console developed by Nintendo." },
            { title: "1-2-Switch", index: 2, extract: "1-2-Switch is a 2017 party video game developed and published by Nintendo." },
          ];
      return { ok: true, status: 200, json: async () => ({ query: { pages: list } }) };
    });

    const result = await findWikipediaDescription({ title: "1-2 Switch", creator: "Nintendo", category: "game" }, "pl");

    expect(new URL(fetchMock.mock.calls[1][0]).host).toBe("en.wikipedia.org");
    expect(result).toEqual({
      description: "1-2-Switch is a 2017 party video game developed and published by Nintendo.",
      url: "https://en.wikipedia.org/wiki/1-2-Switch",
    });
  });

  it("on English Wikipedia, needs an English disambiguation note of the right kind", async () => {
    fetchMock.mockImplementation(async (href: string) => {
      const list: Page[] = href.includes("pl.wikipedia.org")
        ? []
        : [
            { title: "Dune (2021 film)", index: 1, extract: "Dune is a 2021 film based on the novel by Frank Herbert." },
            { title: "Dune (novel)", index: 2, extract: "Dune is a 1965 science fiction novel by Frank Herbert." },
          ];
      return { ok: true, status: 200, json: async () => ({ query: { pages: list } }) };
    });

    const result = await findWikipediaDescription({ title: "Dune", creator: "Frank Herbert", category: "book" }, "pl");
    expect(result?.url).toBe("https://en.wikipedia.org/wiki/Dune_(novel)");
  });

  it("does not ask English Wikipedia when the Polish article matches", async () => {
    pages([{ title: "Solaris", index: 1, extract: "Solaris – powieść Stanisława Lema." }]);
    await findWikipediaDescription({ title: "Solaris", creator: "Stanisław Lem", category: "book" }, "pl");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks only English Wikipedia for an English UI", async () => {
    pages([{ title: "Solaris", index: 1, extract: "Solaris is a 1961 novel by Stanisław Lem." }]);
    const result = await findWikipediaDescription({ title: "Solaris", creator: "Stanisław Lem", category: "book" }, "en");
    expect(new URL(fetchMock.mock.calls[0][0]).host).toBe("en.wikipedia.org");
    expect(result?.url).toBe("https://en.wikipedia.org/wiki/Solaris");
  });

  it("asks German Wikipedia first for a German UI, English as a fallback", async () => {
    fetchMock.mockImplementation(async (href: string) => {
      const list: Page[] = href.includes("de.wikipedia.org")
        ? [{ title: "Dune (Roman)", index: 1, extract: "Dune ist ein Science-Fiction-Roman von Frank Herbert." }]
        : [];
      return { ok: true, status: 200, json: async () => ({ query: { pages: list } }) };
    });
    const result = await findWikipediaDescription({ title: "Dune", creator: null, category: "book" }, "de");
    expect(new URL(fetchMock.mock.calls[0][0]).host).toBe("de.wikipedia.org");
    expect(result?.url).toBe("https://de.wikipedia.org/wiki/Dune_(Roman)");
  });

  it("returns null when Wikipedia has nothing or fails", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ batchcomplete: true }) });
    expect(await findWikipediaDescription({ title: "Szepty spoza nicości", creator: "Remigiusz Mróz", category: "book" }, "pl")).toBeNull();

    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await findWikipediaDescription({ title: "Solaris", creator: "Stanisław Lem", category: "book" }, "pl")).toBeNull();
  });

  it("looks the original title up too, e.g. a Polish game that only has an English article", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const search = new URL(String(url)).searchParams.get("gsrsearch");
      const list: Page[] =
        search === "Knowledge is Power"
          ? [{ title: "Knowledge is Power", index: 1, extract: "Knowledge is Power is a party video game for PlayStation 4." }]
          : [];
      return { ok: true, status: 200, json: async () => ({ query: { pages: list } }) };
    });

    const result = await findWikipediaDescription(
      { title: "Wiedza to potęga", originalTitle: "Knowledge is Power", category: "game" },
      "en"
    );
    expect(result?.url).toBe("https://en.wikipedia.org/wiki/Knowledge_is_Power");
  });
});
