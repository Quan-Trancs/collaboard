import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as AuthContext from "@/contexts/AuthContext";
import { boardApi } from "@/lib/api";
import type { User } from "@/types";
import BoardsList from "./BoardsList";

const boards = [
  {
    id: "board-1",
    title: "Design Sprint",
    description: "Week one",
    owner_id: "user-1",
    permission: "owner" as const,
    is_public: false,
    created_at: "2026-09-06T00:00:00.000Z",
    updated_at: "2026-09-06T00:00:00.000Z",
  },
  {
    id: "board-2",
    title: "Retro Notes",
    description: "",
    owner_id: "user-1",
    permission: "owner" as const,
    is_public: true,
    created_at: "2026-09-06T00:00:00.000Z",
    updated_at: "2026-09-06T00:00:00.000Z",
  },
  {
    id: "board-shared",
    title: "Team Plan",
    description: "From a teammate",
    owner_id: "user-9",
    permission: "edit" as const,
    is_public: false,
    created_at: "2026-09-06T00:00:00.000Z",
    updated_at: "2026-09-06T00:00:00.000Z",
  },
];

const userProp: User = {
  id: "user-1",
  email: "slide@example.com",
  name: "Slide User",
  created_at: "2026-09-06T00:00:00.000Z",
  updated_at: "2026-09-06T00:00:00.000Z",
};

function stubAuth() {
  vi.spyOn(AuthContext, "useAuth").mockReturnValue({
    user: userProp,
    profile: userProp,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    updateProfile: vi.fn(),
    resetPassword: vi.fn(),
    updateUser: vi.fn(),
    signInWithMagicLink: vi.fn(),
  });
}

function renderList(overrides?: {
  onCreateBoard?: (id?: string) => void;
  onOpenBoard?: (id: string) => void;
  onLogout?: () => void;
}) {
  stubAuth();
  vi.spyOn(boardApi, "getBoards").mockResolvedValue(boards);
  vi.spyOn(boardApi, "createBoard").mockResolvedValue({
    id: "board-3",
    title: "Untitled Board",
    owner_id: "user-1",
    permission: "owner",
    is_public: false,
    created_at: "2026-09-06T00:00:00.000Z",
    updated_at: "2026-09-06T00:00:00.000Z",
  });
  vi.spyOn(boardApi, "deleteBoard").mockResolvedValue();

  return render(
    <BoardsList
      user={userProp}
      onCreateBoard={overrides?.onCreateBoard ?? vi.fn()}
      onOpenBoard={overrides?.onOpenBoard ?? vi.fn()}
      onLogout={overrides?.onLogout ?? vi.fn()}
    />
  );
}

describe("BoardsList", () => {
  beforeEach(() => {
    stubAuth();
  });

  it("lists boards after load", async () => {
    renderList();
    expect(await screen.findByText("Design Sprint")).toBeInTheDocument();
    expect(screen.getByText("Retro Notes")).toBeInTheDocument();
    expect(screen.getByText("Team Plan")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Owned" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Shared" })).toBeInTheDocument();
    expect(screen.getByText(/welcome back, slide user/i)).toBeInTheDocument();
  });

  it("puts owned and shared boards in their own categories", async () => {
    renderList();
    await screen.findByText("Design Sprint");
    const owned = screen.getByLabelText("Owned");
    const shared = screen.getByLabelText("Shared");
    expect(owned).toHaveTextContent("Design Sprint");
    expect(owned).toHaveTextContent("Retro Notes");
    expect(owned).not.toHaveTextContent("Team Plan");
    expect(shared).toHaveTextContent("Team Plan");
    expect(shared).toHaveTextContent("Can edit");
    expect(shared).not.toHaveTextContent("Design Sprint");
  });

  it("filters boards by search", async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText("Design Sprint");
    await user.type(screen.getByPlaceholderText(/search boards/i), "retro");
    expect(screen.queryByText("Design Sprint")).not.toBeInTheDocument();
    expect(screen.queryByText("Team Plan")).not.toBeInTheDocument();
    expect(screen.getByText("Retro Notes")).toBeInTheDocument();
  });

  it("opens a board when its card is clicked", async () => {
    const onOpenBoard = vi.fn();
    const user = userEvent.setup();
    renderList({ onOpenBoard });
    await user.click(await screen.findByText("Design Sprint"));
    expect(onOpenBoard).toHaveBeenCalledWith("board-1");
  });

  it("creates a board and reports the new id", async () => {
    const onCreateBoard = vi.fn();
    const user = userEvent.setup();
    renderList({ onCreateBoard });
    await screen.findByText("Design Sprint");
    await user.click(screen.getByRole("button", { name: /new board/i }));
    await waitFor(() => expect(onCreateBoard).toHaveBeenCalledWith("board-3"));
  });

  it("reloads boards when the signed-in user changes", async () => {
    stubAuth();
    const getBoards = vi.spyOn(boardApi, "getBoards").mockResolvedValue(boards);
    const { rerender } = render(
      <BoardsList
        user={userProp}
        onCreateBoard={vi.fn()}
        onOpenBoard={vi.fn()}
        onLogout={vi.fn()}
      />
    );
    expect(await screen.findByText("Design Sprint")).toBeInTheDocument();

    const otherUser = { ...userProp, id: "user-2", email: "other@example.com", name: "Other User" };
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({
      user: otherUser,
      profile: otherUser,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      updateProfile: vi.fn(),
      resetPassword: vi.fn(),
      updateUser: vi.fn(),
      signInWithMagicLink: vi.fn(),
    });
    getBoards.mockResolvedValue([
      {
        id: "board-9",
        title: "Other Account Board",
        owner_id: "user-2",
        is_public: false,
        created_at: "2026-09-06T00:00:00.000Z",
        updated_at: "2026-09-06T00:00:00.000Z",
      },
    ]);

    rerender(
      <BoardsList
        user={otherUser}
        onCreateBoard={vi.fn()}
        onOpenBoard={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(await screen.findByText("Other Account Board")).toBeInTheDocument();
    expect(screen.queryByText("Design Sprint")).not.toBeInTheDocument();
    expect(screen.getByText(/welcome back, other user/i)).toBeInTheDocument();
  });

  it("keeps the board after canceling delete", async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText("Design Sprint");
    await user.click(screen.getByRole("button", { name: /delete design sprint/i }));
    expect(await screen.findByText(/are you sure you want to delete/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByText("Design Sprint")).toBeInTheDocument();
    expect(boardApi.deleteBoard).not.toHaveBeenCalled();
  });
});
