import { render, screen, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LegalPage } from "../LegalPage";
import { DELETE_ACCOUNT, PRIVACY } from "@/lib/legal/content";
import { setLocale } from "@/lib/i18n/locale";

describe("LegalPage", () => {
  it("shows the privacy policy in the UI language, without needing an account", () => {
    render(<LegalPage texts={PRIVACY} />);
    expect(screen.getByRole("heading", { name: "Polityka prywatności", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Udostępnianie kolekcji" })).toBeInTheDocument();

    act(() => setLocale("en"));
    expect(screen.getByRole("heading", { name: "Privacy policy", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sharing your collection" })).toBeInTheDocument();
    act(() => setLocale("pl"));
  });

  it("shows the account deletion steps and links between the legal pages", () => {
    render(<LegalPage texts={DELETE_ACCOUNT} />);
    expect(screen.getByRole("heading", { name: "Usuń konto w Katalogu", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Wybierz „Usuń konto”/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Polityka prywatności" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Usuń konto" })).toHaveAttribute("href", "/delete-account");
  });
});
