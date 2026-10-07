import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FloatingFeedbackButton from "@/components/FloatingFeedbackButton";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock AuthContext
let mockUser: { id: string; email: string } | null = {
  id: "user-123",
  email: "test@example.com",
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    session: null,
    signOut: vi.fn(),
  }),
}));

describe("FloatingFeedbackButton", () => {
  it("renders when user is authenticated on normal routes", () => {
    mockUser = { id: "user-123", email: "test@example.com" };
    render(
      <MemoryRouter initialEntries={["/"]}>
        <FloatingFeedbackButton />
      </MemoryRouter>
    );

    const button = screen.getByRole("button", { name: /send feedback/i });
    expect(button).toBeInTheDocument();
  });

  it("does not render when user is not authenticated", () => {
    mockUser = null;
    render(
      <MemoryRouter initialEntries={["/"]}>
        <FloatingFeedbackButton />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: /send feedback/i })).not.toBeInTheDocument();
  });

  it("does not render when already on /feedback route", () => {
    mockUser = { id: "user-123", email: "test@example.com" };
    render(
      <MemoryRouter initialEntries={["/feedback"]}>
        <FloatingFeedbackButton />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: /send feedback/i })).not.toBeInTheDocument();
  });

  it("navigates to /feedback when clicked", async () => {
    mockUser = { id: "user-123", email: "test@example.com" };
    render(
      <MemoryRouter initialEntries={["/"]}>
        <FloatingFeedbackButton />
      </MemoryRouter>
    );

    const button = screen.getByRole("button", { name: /send feedback/i });
    fireEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith("/feedback");
  });
});
