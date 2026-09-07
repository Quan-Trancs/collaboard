import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthProvider } from "@/contexts/AuthContext";
import * as apiClient from "@/lib/apiClient";
import AuthForm from "./AuthForm";

function renderAuth() {
  return render(
    <AuthProvider>
      <AuthForm />
    </AuthProvider>
  );
}

describe("AuthForm", () => {
  beforeEach(() => {
    vi.spyOn(apiClient, "apiRequest");
  });

  it("shows the sign-in screen by default", async () => {
    renderAuth();
    expect(await screen.findByRole("heading", { name: /sign in to your account/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
  });

  it("switches to sign up and shows the name field", async () => {
    const user = userEvent.setup();
    renderAuth();
    await screen.findByRole("heading", { name: /sign in to your account/i });
    await user.click(screen.getByRole("button", { name: /don't have an account/i }));
    expect(screen.getByRole("heading", { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
  });

  it("does not call the login API when email is invalid", async () => {
    const user = userEvent.setup();
    renderAuth();
    await screen.findByLabelText("Email");
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "devpass123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(apiClient.apiRequest).not.toHaveBeenCalled();
  });

  it("fills the demo account when development login is enabled", async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <AuthForm showDevLogin />
      </AuthProvider>
    );
    await user.click(await screen.findByRole("button", { name: /use demo account/i }));
    expect(screen.getByLabelText("Email")).toHaveValue("slide@example.com");
    expect(screen.getByLabelText("Password", { selector: "input" })).toHaveValue("devpass123");
  });

  it("calls the login API with valid credentials", async () => {
    vi.mocked(apiClient.apiRequest).mockResolvedValue({
      user: { id: "1", email: "slide@example.com", name: "Slide User" },
      token: "test-token",
    });
    const user = userEvent.setup();
    renderAuth();
    await screen.findByLabelText("Email");
    await user.type(screen.getByLabelText("Email"), "slide@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "devpass123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() => {
      expect(apiClient.apiRequest).toHaveBeenCalledWith(
        "/auth/login",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
