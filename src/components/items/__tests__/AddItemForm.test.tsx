import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AddItemForm } from "../AddItemForm";

const mockUploadCoverImage = vi.fn().mockResolvedValue({
  publicUrl: "https://example.supabase.co/covers/test.jpg",
  error: null,
});

vi.mock("@/lib/storage/upload", () => ({
  uploadCoverImage: (...args: unknown[]) => mockUploadCoverImage(...args),
}));

describe("AddItemForm", () => {
  it("renders all form fields", () => {
    render(<AddItemForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Tytuł *")).toBeInTheDocument();
    expect(screen.getByLabelText("Kategoria")).toBeInTheDocument();
    expect(screen.getByLabelText("Twórca / Wykonawca")).toBeInTheDocument();
    expect(screen.getByLabelText("Podkategoria / Format")).toBeInTheDocument();
    expect(screen.getByLabelText("URL Okładki")).toBeInTheDocument();
  });

  it("submits form data and calls onSubmit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<AddItemForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Tytuł *"), {
      target: { value: "Hobbit" },
    });
    fireEvent.change(screen.getByLabelText("Twórca / Wykonawca"), {
      target: { value: "J.R.R. Tolkien" },
    });
    fireEvent.change(screen.getByLabelText("Podkategoria / Format"), {
      target: { value: "Fantasy" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Dodaj do kolekcji" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: "Hobbit",
        artist_creator: "J.R.R. Tolkien",
        category: "book",
        subcategory: "Fantasy",
        cover_url: null,
        metadata: {},
      });
      // Should clear title
      expect((screen.getByLabelText("Tytuł *") as HTMLInputElement).value).toBe("");
    });
  });

  it("shows error when submission fails", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    render(<AddItemForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Tytuł *"), {
      target: { value: "Hobbit" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Dodaj do kolekcji" }));

    await waitFor(() => {
      expect(screen.getByText("Nie udało się zapisać elementu.")).toBeInTheDocument();
    });
  });

  it("renders a single CoverScanner button on the add-item form", () => {
    render(<AddItemForm onSubmit={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Zeskanuj okładkę/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Skanuj kod kreskowy/i })).not.toBeInTheDocument();
  });

  it("uploads dataUrl cover image to storage on submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<AddItemForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Tytuł *"), {
      target: { value: "Hobbit" },
    });
    fireEvent.change(screen.getByLabelText("URL Okładki"), {
      target: { value: "data:image/jpeg;base64,mockImageContent" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Dodaj do kolekcji" }));

    await waitFor(() => {
      expect(mockUploadCoverImage).toHaveBeenCalledWith("data:image/jpeg;base64,mockImageContent");
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          cover_url: "https://example.supabase.co/covers/test.jpg",
        })
      );
    });
  });
  it("shows upload error message and does not call onSubmit when storage upload fails", async () => {
    mockUploadCoverImage.mockResolvedValueOnce({
      publicUrl: null,
      error: "Bucket 'covers' not found or permission denied",
    });

    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<AddItemForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Tytuł *"), {
      target: { value: "Hobbit" },
    });
    fireEvent.change(screen.getByLabelText("URL Okładki"), {
      target: { value: "data:image/jpeg;base64,mockImageContent" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Dodaj do kolekcji" }));

    await waitFor(() => {
      expect(
        screen.getByText(/Błąd przesyłania okładki/)
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
