import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SharePage from "../page";

vi.mock("../ShareContent", () => ({
  ShareContent: () => <div data-testid="share-content-mock">Mock Share Content</div>,
}));

describe("SharePage", () => {
  it("renders header, public badge and ShareContent component", () => {
    render(<SharePage params={Promise.resolve({ userId: "test-user-123" })} />);

    expect(screen.getByRole("heading", { name: "Katalog", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Publiczny")).toBeInTheDocument();
    expect(screen.getByTestId("share-content-mock")).toBeInTheDocument();
  });
});
