import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CollectionTypesPicker } from "../CollectionTypesPicker";

describe("CollectionTypesPicker", () => {
  it("starts from the given selection and saves the chosen types in the app's order", async () => {
    const onSave = vi.fn().mockResolvedValue(null);
    render(<CollectionTypesPicker initial={["game"]} onSave={onSave} />);

    expect(screen.getByRole("button", { name: "Gry" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Książki" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Muzyka" }));
    fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(["music", "game"]));
  });

  it("cannot be saved with nothing selected", () => {
    render(<CollectionTypesPicker initial={["book"]} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Książki" }));
    expect(screen.getByRole("button", { name: "Zapisz" })).toBeDisabled();
  });

  it("shows the save error", async () => {
    render(<CollectionTypesPicker initial={["book"]} onSave={vi.fn().mockResolvedValue("boom")} />);
    fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });

  it("has a back button only when it can be cancelled", () => {
    const onCancel = vi.fn();
    const { rerender } = render(<CollectionTypesPicker initial={[]} onSave={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Wróć" })).not.toBeInTheDocument();

    rerender(<CollectionTypesPicker initial={[]} onSave={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Wróć" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
