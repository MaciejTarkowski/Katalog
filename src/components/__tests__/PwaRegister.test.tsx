import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PwaRegister } from "../PwaRegister";

describe("PwaRegister", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders null without throwing", () => {
    const { container } = render(<PwaRegister />);
    expect(container.firstChild).toBeNull();
  });

  it("attempts to register service worker in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const registerMock = vi.fn().mockResolvedValue({ scope: "/" });

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: registerMock,
      },
      configurable: true,
      writable: true,
    });

    render(<PwaRegister />);

    expect(registerMock).toHaveBeenCalledWith("/sw.js");
  });

  it("does not register service worker in development or test environment", () => {
    vi.stubEnv("NODE_ENV", "test");
    const registerMock = vi.fn().mockResolvedValue({ scope: "/" });

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: registerMock,
      },
      configurable: true,
      writable: true,
    });

    render(<PwaRegister />);

    expect(registerMock).not.toHaveBeenCalled();
  });
});
