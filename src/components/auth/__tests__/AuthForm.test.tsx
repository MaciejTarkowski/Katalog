import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthForm } from "../AuthForm";

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignIn,
      signUp: mockSignUp,
    },
  }),
}));

describe("AuthForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login form by default", () => {
    render(<AuthForm />);
    expect(screen.getByRole("heading", { name: "Zaloguj się do Katalogu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zaloguj się" })).toBeInTheDocument();
    expect(screen.getByText("Nie masz konta? Zarejestruj się")).toBeInTheDocument();
  });

  it("toggles between sign in and sign up", () => {
    render(<AuthForm />);
    const toggleButton = screen.getByText("Nie masz konta? Zarejestruj się");
    fireEvent.click(toggleButton);

    expect(screen.getByRole("heading", { name: "Utwórz konto w Katalogu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zarejestruj się" })).toBeInTheDocument();
  });

  it("calls signInWithPassword and displays success", async () => {
    mockSignIn.mockResolvedValue({ error: null, data: { user: { id: "123" } } });
    const onSuccess = vi.fn();

    render(<AuthForm onSuccess={onSuccess} />);
    fireEvent.change(screen.getByLabelText("Adres e-mail"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Hasło"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Zaloguj się" }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
      expect(onSuccess).toHaveBeenCalled();
      expect(screen.getByText("Zalogowano pomyślnie!")).toBeInTheDocument();
    });
  });

  it("displays error message on authentication failure", async () => {
    mockSignIn.mockResolvedValue({ error: { message: "Nieprawidłowe dane" } });

    render(<AuthForm />);
    fireEvent.change(screen.getByLabelText("Adres e-mail"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Hasło"), {
      target: { value: "wrongpass" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Zaloguj się" }));

    await waitFor(() => {
      expect(screen.getByText("Nieprawidłowe dane")).toBeInTheDocument();
    });
  });
});
