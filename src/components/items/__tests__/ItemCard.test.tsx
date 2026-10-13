import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ItemCard } from "../ItemCard";
import { Item } from "@/types/database";

const sampleItem: Item = {
  id: "item-101",
  user_id: "user-1",
  title: "Solaris",
  artist_creator: "Stanisław Lem",
  category: "book",
  subcategory: "Sci-Fi",
  cover_url: null,
  metadata: {},
  created_at: "2026-01-01T12:00:00Z",
};

describe("ItemCard", () => {
  it("renders item title, creator and category badges", () => {
    render(<ItemCard item={sampleItem} />);
    expect(screen.getByText("Solaris")).toBeInTheDocument();
    expect(screen.getByText("Stanisław Lem")).toBeInTheDocument();
    expect(screen.getByText("Książka")).toBeInTheDocument();
    expect(screen.getByText("Sci-Fi")).toBeInTheDocument();
    expect(screen.getByText("S")).toBeInTheDocument(); // initial fallback
  });

  it("renders cover image when cover_url is provided", () => {
    const itemWithCover = {
      ...sampleItem,
      cover_url: "https://example.com/cover.jpg",
    };
    render(<ItemCard item={itemWithCover} />);
    const img = screen.getByAltText("Solaris");
    expect(img).toHaveAttribute("src", "https://example.com/cover.jpg");
  });

  it("calls onDelete callback when delete button is pressed", () => {
    const onDelete = vi.fn();
    render(<ItemCard item={sampleItem} onDelete={onDelete} />);
    const deleteButton = screen.getByRole("button", { name: "Usuń Solaris" });
    fireEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalledWith("item-101");
  });
});
