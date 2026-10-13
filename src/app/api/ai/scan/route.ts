import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "placeholder-gemini-key") {
      return NextResponse.json(
        { error: "Klucz GEMINI_API_KEY nie został skonfigurowany na serwerze." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { imageBase64, mimeType = "image/jpeg" } = body;

    if (!imageBase64) {
      return NextResponse.json(
        { error: "Pole 'imageBase64' jest wymagane do wykonania skanowania." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt =
      "Rozpoznaj przedmiot kolekcjonerski przedstawiony na zdjęciu okładki/pudełka/etykiety (książka, płyta muzyczna, gra wideo, komiks lub inny). " +
      "Wyodrębnij dokładny tytuł, twórcę/autora/zespół/studio, kategorię, podkategorię/format (np. Winyl, CD, PS5, Manga, Hardcover) oraz specyficzne metadane (rok, wydawca, ISBN itp.).";

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
        prompt,
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "Dokładny tytuł dzieła lub przedmiotu",
            },
            artist_creator: {
              type: Type.STRING,
              description: "Autor, wykonawca, deweloper lub twórca",
            },
            category: {
              type: Type.STRING,
              description: "Jedna z głównych kategorii",
              enum: ["book", "music", "game", "comic", "other"],
            },
            subcategory: {
              type: Type.STRING,
              description: "Format lub podgatunek (np. Winyl, Hardcover, RPG)",
            },
            metadata: {
              type: Type.OBJECT,
              description: "Dodatkowe wykryte metadane",
              properties: {
                year: { type: Type.STRING, description: "Rok wydania lub publikacji" },
                publisher: { type: Type.STRING, description: "Wydawnictwo lub wytwórnia" },
                isbn: { type: Type.STRING, description: "Numer ISBN jeśli dostępny" },
                platform: { type: Type.STRING, description: "Platforma sprzętowa dla gier" },
                genre: { type: Type.STRING, description: "Gatunek dzieła" },
              },
            },
          },
          required: ["title", "category"],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return NextResponse.json(
        { error: "Model Gemini nie zwrócił odpowiedzi." },
        { status: 502 }
      );
    }

    const parsedData = JSON.parse(responseText);

    return NextResponse.json({
      success: true,
      data: {
        title: parsedData.title || "",
        artist_creator: parsedData.artist_creator || null,
        category: parsedData.category || "other",
        subcategory: parsedData.subcategory || null,
        metadata: parsedData.metadata || {},
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Wystąpił błąd podczas analizy obrazu przez AI.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
