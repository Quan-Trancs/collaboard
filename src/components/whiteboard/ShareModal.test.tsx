import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { boardApi } from "@/lib/api";
import ShareModal from "./ShareModal";

const BOARD_ID = "507f1f77bcf86cd799439011";

function stubShare() {
  vi.spyOn(boardApi, "getCollaborators").mockResolvedValue({
    owner: {
      id: "user-1",
      name: "Slide User",
      email: "slide@example.com",
      permission: "owner",
    },
    collaborators: [
      {
        id: "user-2",
        name: "Pat Lee",
        email: "pat@example.com",
        permission: "edit",
      },
    ],
    is_public: false,
    can_manage: true,
  });
  vi.spyOn(boardApi, "addCollaborator").mockResolvedValue({
    id: "user-3",
    name: "Alex Kim",
    email: "alex@example.com",
    permission: "view",
  });
  vi.spyOn(boardApi, "updateCollaboratorPermission").mockResolvedValue({
    id: "user-2",
    name: "Pat Lee",
    email: "pat@example.com",
    permission: "view",
  });
  vi.spyOn(boardApi, "removeCollaborator").mockResolvedValue();
  vi.spyOn(boardApi, "updateBoard").mockResolvedValue({
    id: BOARD_ID,
    title: "Design Sprint",
    owner_id: "user-1",
    is_public: true,
    created_at: "2026-09-06T00:00:00.000Z",
    updated_at: "2026-09-06T00:00:00.000Z",
  });
}

describe("ShareModal", () => {
  beforeEach(() => {
    stubShare();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("shows a real board link and people with access", async () => {
    render(
      <ShareModal open boardId={BOARD_ID} boardTitle="Design Sprint" onOpenChange={vi.fn()} />
    );
    expect(await screen.findByText("Slide User")).toBeInTheDocument();
    expect(screen.getByText("Pat Lee")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("Editor")).toBeInTheDocument();
    expect(screen.getByLabelText("Board link")).toHaveValue(
      `${window.location.origin}/?boardId=${BOARD_ID}`
    );
    expect(screen.queryByDisplayValue(/example\.com/)).not.toBeInTheDocument();
  });

  it("invites an existing account by email", async () => {
    const user = userEvent.setup();
    render(
      <ShareModal open boardId={BOARD_ID} boardTitle="Design Sprint" onOpenChange={vi.fn()} />
    );
    await screen.findByText("Pat Lee");
    await user.type(screen.getByLabelText("Invite by email"), "alex@example.com");
    await user.click(screen.getByLabelText("Send invite"));
    await waitFor(() => {
      expect(boardApi.addCollaborator).toHaveBeenCalledWith(BOARD_ID, "alex@example.com", "edit");
    });
    expect(await screen.findByText("Alex Kim")).toBeInTheDocument();
  });

  it("turns on anyone-with-the-link viewing", async () => {
    const user = userEvent.setup();
    render(
      <ShareModal open boardId={BOARD_ID} boardTitle="Design Sprint" onOpenChange={vi.fn()} />
    );
    await screen.findByText("Pat Lee");
    await user.click(screen.getByLabelText("Anyone with the link can view"));
    await waitFor(() => {
      expect(boardApi.updateBoard).toHaveBeenCalledWith(BOARD_ID, { is_public: true });
    });
  });
});
