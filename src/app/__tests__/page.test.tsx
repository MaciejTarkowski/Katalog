import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Home from "../page";

vi.mock("@/components/dashboard/Dashboard", () => ({
  Dashboard: () => <div data-testid="dashboard-mock">Mock Dashboard</div>,
}));

describe("Home Page", () => {
  it("has an accessible app title", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Katalog", level: 1 })).toBeInTheDocument();
  });

  it("renders the Dashboard component", () => {
    render(<Home />);
    expect(screen.getByTestId("dashboard-mock")).toBeInTheDocument();
  });
});
