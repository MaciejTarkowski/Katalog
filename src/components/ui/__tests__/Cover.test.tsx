import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Cover } from "../primitives";

describe("Cover", () => {
  it("does not flash the title initial while the cover image is loading", () => {
    render(<Cover title="Solaris" seed="1" src="https://example.com/s.jpg" alt="Solaris" />);
    expect(screen.queryByText("S")).not.toBeInTheDocument();
    expect(screen.getByAltText("Solaris")).toBeInTheDocument();
  });

  it("shows the initial when there is no cover", () => {
    render(<Cover title="Solaris" seed="1" src={null} />);
    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("falls back to the initial when the cover fails to load", () => {
    render(<Cover title="Solaris" seed="1" src="https://example.com/s.jpg" alt="Solaris" />);
    fireEvent.error(screen.getByAltText("Solaris"));
    expect(screen.getByText("S")).toBeInTheDocument();
  });
});
