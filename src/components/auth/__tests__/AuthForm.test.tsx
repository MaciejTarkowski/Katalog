import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthForm } from "../AuthForm";

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockOAuth = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignIn,
      signUp: mockSignUp,
      signInWithOAuth: mockOAuth,
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

  it("sends the display name with sign up", async () => {
    mockSignUp.mockResolvedValue({ error: null, data: { session: null } });
    render(<AuthForm />);
    expect(screen.queryByLabelText("Nazwa wyświetlana")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Nie masz konta? Zarejestruj się"));
    fireEvent.change(screen.getByLabelText("Nazwa wyświetlana"), { target: { value: " Maciek " } });
    fireEvent.change(screen.getByLabelText("Adres e-mail"), { target: { value: "m@example.com" } });
    fireEvent.change(screen.getByLabelText("Hasło"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Zarejestruj się" }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "m@example.com",
        password: "password123",
        options: {
          data: { display_name: "Maciek" },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    });
  });

  it("shows the Google logo on the continue-with-Google button", () => {
    render(<AuthForm />);
    const button = screen.getByRole("button", { name: "Kontynuuj z Google" });
    expect(button.querySelector("svg")).toBeInTheDocument();
  });

  it("signs in with Google and returns through the auth callback", async () => {
    mockOAuth.mockResolvedValue({ error: null });
    render(<AuthForm />);
    fireEvent.click(screen.getByRole("button", { name: "Kontynuuj z Google" }));

    await waitFor(() => {
      expect(mockOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
    });
  });

  it("shows Google button in sign-up mode too and reports OAuth errors", async () => {
    mockOAuth.mockResolvedValue({ error: { message: "Provider is not enabled" } });
    render(<AuthForm initialMode="signup" />);
    fireEvent.click(screen.getByRole("button", { name: "Kontynuuj z Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Provider is not enabled");
  });
  it("signs in with Apple and returns through the auth callback", async () => {
    mockOAuth.mockResolvedValue({ error: null });
    render(<AuthForm />);
    const button = screen.getByRole("button", { name: "Kontynuuj z Apple" });
    expect(button.querySelector("svg")).toBeInTheDocument();
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOAuth).toHaveBeenCalledWith({
        provider: "apple",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
    });
  });

  it("shows Apple button in sign-up mode too and reports OAuth errors", async () => {
    mockOAuth.mockResolvedValue({ error: { message: "Provider is not enabled" } });
    render(<AuthForm initialMode="signup" />);
    fireEvent.click(screen.getByRole("button", { name: "Kontynuuj z Apple" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Provider is not enabled");
  });
});
