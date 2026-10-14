import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ItemList } from "../ItemList";
import { Item } from "@/types/database";

const itemsMock: Item[] = [
  {
    id: "item-1",
    user_id: "user-1",
    title: "Diuna",
    artist_creator: "Frank Herbert",
    category: "book",
    subcategory: "Sci-Fi",
    cover_url: null,
    metadata: {},
    created_at: "2026-01-01T12:00:00Z",
  },
  {
    id: "item-2",
    user_id: "user-1",
    title: "Abbey Road",
    artist_creator: "The Beatles",
    category: "music",
    subcategory: "Vinyl",
    cover_url: null,
    metadata: {},
    created_at: "2026-01-02T12:00:00Z",
  },
];

describe("ItemList", () => {
  it("renders all items when category is 'all'", () => {
    render(
      <ItemList
        items={itemsMock}
        selectedCategory="all"
        onSelectCategory={vi.fn()}
        onDeleteItem={vi.fn()}
      />
    );

    expect(screen.getByText("Diuna")).toBeInTheDocument();
    expect(screen.getByText("Abbey Road")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // count
  });

  it("filters items according to selected category", () => {
    render(
      <ItemList
        items={itemsMock}
        selectedCategory="book"
        onSelectCategory={vi.fn()}
        onDeleteItem={vi.fn()}
      />
    );

    expect(screen.getByText("Diuna")).toBeInTheDocument();
    expect(screen.queryByText("Abbey Road")).not.toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // count
  });

  it("shows a horizontal row per non-empty category in the 'all' view", () => {
    render(
      <ItemList items={itemsMock} selectedCategory="all" onSelectCategory={vi.fn()} />
    );

    const books = screen.getByRole("region", { name: "Książki" });
    const music = screen.getByRole("region", { name: "Muzyka" });
    expect(within(books).getByText("Diuna")).toBeInTheDocument();
    expect(within(music).getByText("Abbey Road")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Gry" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("item-grid")).not.toBeInTheDocument();
  });

  it("shows a cover grid when a category is selected", () => {
    render(
      <ItemList items={itemsMock} selectedCategory="music" onSelectCategory={vi.fn()} />
    );

    expect(within(screen.getByTestId("item-grid")).getByText("Abbey Road")).toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("calls onSelectCategory when clicking a category tab", () => {
    const onSelectCategory = vi.fn();
    render(
      <ItemList
        items={itemsMock}
        selectedCategory="all"
        onSelectCategory={onSelectCategory}
        onDeleteItem={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Książki" }));
    expect(onSelectCategory).toHaveBeenCalledWith("book");
  });

  it("renders empty state when no items match category", () => {
    render(
      <ItemList
        items={[]}
        selectedCategory="game"
        onSelectCategory={vi.fn()}
        onDeleteItem={vi.fn()}
      />
    );

    expect(screen.getByText("Pusta kolekcja")).toBeInTheDocument();
  });
});
