import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { boardApi, objectApi, drawingApi } from "@/lib/api";
import * as useSocketMod from "@/hooks/useSocket";
import Whiteboard from "./Whiteboard";
import { serializeElements } from "./boardClipboard";
import { MAX_STROKE_POINTS } from "@/lib/strokeChunks";
import type { BoardPermission } from "@/types";

const BOARD_ID = "507f1f77bcf86cd799439011";

function stubSocket(overrides: Partial<ReturnType<typeof useSocketMod.useSocket>> = {}) {
  vi.spyOn(useSocketMod, "useSocket").mockReturnValue({
    socket: null,
    isConnected: false,
    boardState: null,
    error: null,
    sendCursorMove: vi.fn(),
    sendDrawingStart: vi.fn(),
    sendDrawingUpdate: vi.fn(),
    sendElementDelete: vi.fn(),
    sendUndo: vi.fn(),
    sendRedo: vi.fn(),
    sendViewport: vi.fn(),
    commitDrawing: vi.fn(),
    flushBoard: vi.fn(),
    clearBoard: vi.fn(),
    sendChat: vi.fn(),
    markChatRead: vi.fn(),
    chatMessages: [],
    unreadChat: 0,
    chatError: null,
    chatSending: false,
    rejectedDraft: null,
    onElementAdded: vi.fn(() => () => {}),
    onElementUpdated: vi.fn(() => () => {}),
    onElementDeleted: vi.fn(() => () => {}),
    onUndoApplied: vi.fn(() => () => {}),
    onRedoApplied: vi.fn(() => () => {}),
    onCursorUpdate: vi.fn(() => () => {}),
    onBoardCleared: vi.fn(() => () => {}),
    onUserLeft: vi.fn(() => () => {}),
    ...overrides,
  });
}

function stubBoard(overrides?: { can_edit?: boolean; permission?: BoardPermission }) {
  vi.spyOn(boardApi, "getBoard").mockResolvedValue({
    id: BOARD_ID,
    title: "Design Sprint",
    owner_id: "user-1",
    is_public: false,
    created_at: "2026-09-06T00:00:00.000Z",
    updated_at: "2026-09-06T00:00:00.000Z",
    viewport: { x: -2000, y: -2000, zoom: 1 },
    objects: [],
    drawings: [],
    can_edit: overrides?.can_edit ?? true,
    permission: overrides?.permission ?? "owner",
    collaborators: [],
  });
  vi.spyOn(objectApi, "getObjects").mockResolvedValue([]);
  vi.spyOn(drawingApi, "getDrawings").mockResolvedValue([]);
}

function renderBoard(overrides?: {
  onBackToDashboard?: () => void;
  onLogout?: () => void;
  can_edit?: boolean;
  permission?: BoardPermission;
}) {
  stubSocket();
  stubBoard({ can_edit: overrides?.can_edit, permission: overrides?.permission });
  return render(
    <TooltipProvider>
      <Whiteboard
        boardId={BOARD_ID}
        user={{ id: "user-1", email: "slide@example.com", name: "Slide User" }}
        onBackToDashboard={overrides?.onBackToDashboard ?? vi.fn()}
        onLogout={overrides?.onLogout ?? vi.fn()}
      />
    </TooltipProvider>
  );
}

describe("Whiteboard", () => {
  beforeEach(() => {
    stubSocket();
    stubBoard();
  });

  it("shows tools and the board title after load", async () => {
    renderBoard();
    expect(await screen.findByLabelText("Whiteboard toolbar")).toBeInTheDocument();
    expect(screen.getByLabelText("Pen tool")).toBeInTheDocument();
    expect(screen.getByLabelText("Rectangle tool")).toBeInTheDocument();
    expect(screen.getByLabelText("Circle tool")).toBeInTheDocument();
    expect(screen.getByLabelText("Text tool")).toBeInTheDocument();
    expect(screen.getByLabelText("Eraser tool")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Design Sprint" })).toBeInTheDocument();
    expect(screen.getByLabelText("Collaborator list")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("opens board chat from the header", async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole("heading", { name: "Design Sprint" });
    await user.click(screen.getByLabelText("Chat"));
    expect(screen.getByLabelText("Board chat")).toBeInTheDocument();
    expect(screen.getByText("No messages yet. Say hello.")).toBeInTheDocument();
    expect(screen.getByLabelText("Chat message")).toBeDisabled();
    await user.click(screen.getByLabelText("Close chat"));
    expect(screen.queryByLabelText("Board chat")).not.toBeInTheDocument();
  });

  it("locks drawing tools for view-only collaborators", async () => {
    renderBoard({ can_edit: false, permission: "view" });
    expect(await screen.findByText("View only")).toBeInTheDocument();
    expect(screen.getByLabelText("Pen tool")).toBeDisabled();
    expect(screen.getByLabelText("Undo")).toBeDisabled();
    expect(screen.getByLabelText("Redo")).toBeDisabled();
  });

  it("does not treat remote undo/redo as a local history edit", async () => {
    let onUndoApplied: ((data: {
      action: string;
      elementId?: string;
      canUndo?: boolean;
      canRedo?: boolean;
    }) => void) | undefined;
    stubSocket({
      socket: { id: "sock-remote" } as never,
      isConnected: true,
      boardState: {
        elements: [],
        users: [],
        cursors: [],
        canUndo: true,
        canRedo: false,
      },
      onUndoApplied: vi.fn((callback) => {
        onUndoApplied = callback;
        return () => {};
      }),
    });
    stubBoard();
    render(
      <TooltipProvider>
        <Whiteboard
          boardId={BOARD_ID}
          user={{ id: "user-1", email: "slide@example.com", name: "Slide User" }}
          onBackToDashboard={vi.fn()}
          onLogout={vi.fn()}
        />
      </TooltipProvider>
    );

    await screen.findByRole("heading", { name: "Design Sprint" });
    await waitFor(() => {
      expect(screen.getByLabelText("Undo")).toBeEnabled();
      expect(screen.getByLabelText("Redo")).toBeDisabled();
    });

    onUndoApplied?.({
      action: "delete",
      elementId: "remote-stroke",
      canUndo: false,
      canRedo: true,
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Undo")).toBeDisabled();
      expect(screen.getByLabelText("Redo")).toBeEnabled();
    });
  });

  it("changes the zoom label when zooming in", async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByText("100%");
    await user.click(screen.getByLabelText("Zoom in"));
    await waitFor(() => {
      expect(screen.getByText("110%")).toBeInTheDocument();
    });
  });

  it("zooms with a cancelable wheel event without throwing", async () => {
    renderBoard();
    const canvas = await screen.findByLabelText("Whiteboard canvas area");
    await screen.findByText("100%");
    fireEvent.wheel(canvas, { deltaY: -100, clientX: 80, clientY: 80, cancelable: true });
    await waitFor(() => {
      expect(screen.getByText("110%")).toBeInTheDocument();
    });
  });

  it("goes back to the dashboard from the toolbar", async () => {
    const onBackToDashboard = vi.fn();
    const user = userEvent.setup();
    renderBoard({ onBackToDashboard });
    await screen.findByLabelText("Back to dashboard");
    await user.click(screen.getByLabelText("Back to dashboard"));
    expect(onBackToDashboard).toHaveBeenCalled();
  });

  it("shows a Word-style text ribbon with size in px after choosing Text", async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByLabelText("Text tool");
    expect(screen.queryByLabelText("Text style")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Text tool"));
    expect(screen.getByLabelText("Text style")).toBeInTheDocument();
    expect(screen.getByLabelText("Font family")).toBeInTheDocument();
    expect(screen.getByLabelText("Font size in pixels")).toHaveValue(24);
    expect(screen.getByLabelText("Font size slider")).toBeInTheDocument();
    expect(screen.getByText("px")).toBeInTheDocument();
    expect(screen.getByLabelText("Bold")).toBeInTheDocument();
    expect(screen.getByLabelText("Italic")).toBeInTheDocument();
    expect(screen.getByLabelText("Underline")).toBeInTheDocument();
    expect(screen.getByLabelText("Strikethrough")).toBeInTheDocument();
    expect(screen.getByLabelText("Align left")).toBeInTheDocument();
    expect(screen.getByLabelText("Line spacing")).toBeInTheDocument();
    expect(screen.getByLabelText("Highlight layout")).toBeInTheDocument();
  });

  it("creates an edit box on the canvas and can highlight layout", async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByLabelText("Text tool");
    await user.click(screen.getByLabelText("Text tool"));
    await user.click(screen.getByLabelText("Highlight layout"));
    expect(screen.getByLabelText("Highlight layout")).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByLabelText("Drawing canvas"));
    expect(screen.getByLabelText("Text box editor")).toBeInTheDocument();
    expect(screen.getByLabelText("Text box input")).toBeInTheDocument();
    expect(screen.getByLabelText("Resize text box")).toBeInTheDocument();
  });

  it("stops the pen after the mouse is released outside the canvas", async () => {
    const commitDrawing = vi.fn();
    const sendDrawingUpdate = vi.fn();
    stubSocket({
      socket: { id: "sock-1" } as never,
      isConnected: true,
      sendDrawingUpdate,
      commitDrawing,
    });
    stubBoard();
    render(
      <TooltipProvider>
        <Whiteboard
          boardId={BOARD_ID}
          user={{ id: "user-1", email: "slide@example.com", name: "Slide User" }}
          onBackToDashboard={vi.fn()}
          onLogout={vi.fn()}
        />
      </TooltipProvider>
    );

    const canvas = await screen.findByLabelText("Drawing canvas");
    fireEvent.pointerDown(canvas, { clientX: 80, clientY: 80, button: 0, buttons: 1 });
    fireEvent.pointerMove(canvas, { clientX: 120, clientY: 110, buttons: 1 });
    fireEvent.mouseUp(window);
    expect(sendDrawingUpdate).toHaveBeenCalled();
    expect(commitDrawing).toHaveBeenCalled();

    const commits = commitDrawing.mock.calls.length;
    fireEvent.pointerMove(canvas, { clientX: 200, clientY: 180, buttons: 0 });
    expect(commitDrawing.mock.calls.length).toBe(commits);
  });

  it("splits a long pen stroke into a new socket element", async () => {
    const sendDrawingStart = vi.fn();
    const sendDrawingUpdate = vi.fn();
    const commitDrawing = vi.fn();
    stubSocket({
      socket: { id: "sock-1" } as never,
      isConnected: true,
      sendDrawingStart,
      sendDrawingUpdate,
      commitDrawing,
    });
    stubBoard();
    render(
      <TooltipProvider>
        <Whiteboard
          boardId={BOARD_ID}
          user={{ id: "user-1", email: "slide@example.com", name: "Slide User" }}
          onBackToDashboard={vi.fn()}
          onLogout={vi.fn()}
        />
      </TooltipProvider>
    );

    const canvas = await screen.findByLabelText("Drawing canvas");
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40, button: 0, buttons: 1 });
    for (let index = 1; index <= MAX_STROKE_POINTS; index += 1) {
      fireEvent.pointerMove(canvas, { clientX: 40 + index, clientY: 40, buttons: 1 });
    }

    expect(commitDrawing).toHaveBeenCalled();
    expect(sendDrawingStart.mock.calls.length).toBeGreaterThanOrEqual(2);
    const lastStart = sendDrawingStart.mock.calls.at(-1)?.[0];
    expect(lastStart.points.length).toBeLessThanOrEqual(MAX_STROKE_POINTS);
  });

  it("pastes a copied shape onto the board", async () => {
    const sendDrawingStart = vi.fn();
    stubSocket({
      socket: { id: "sock-1" } as never,
      isConnected: true,
      sendDrawingStart,
    });
    stubBoard();
    render(
      <TooltipProvider>
        <Whiteboard
          boardId={BOARD_ID}
          user={{ id: "user-1", email: "slide@example.com", name: "Slide User" }}
          onBackToDashboard={vi.fn()}
          onLogout={vi.fn()}
        />
      </TooltipProvider>
    );
    await screen.findByLabelText("Drawing canvas");

    fireEvent.paste(window, {
      clipboardData: {
        getData: () =>
          serializeElements([
            {
              id: "shape-1",
              type: "shape",
              x: 40,
              y: 50,
              width: 100,
              height: 100,
              shapeType: "hexagon",
              color: "#000000",
              strokeWidth: 2,
            },
          ]),
        files: [],
        items: [],
        types: ["text/plain"],
      },
    });

    expect(sendDrawingStart).toHaveBeenCalledWith(
      expect.objectContaining({ type: "shape", shapeType: "hexagon", x: 64, y: 74 })
    );
    expect(screen.getByTestId("overlay-objects")).toHaveAttribute("data-interactive", "false");

    await userEvent.setup().click(screen.getByLabelText("Select tool"));
    expect(screen.getByTestId("overlay-objects")).toHaveAttribute("data-interactive", "true");
  });

  it("deletes the selected object with Delete", async () => {
    const sendDrawingStart = vi.fn();
    const sendElementDelete = vi.fn();
    stubSocket({
      socket: { id: "sock-1" } as never,
      isConnected: true,
      sendDrawingStart,
      sendElementDelete,
    });
    stubBoard();
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <Whiteboard
          boardId={BOARD_ID}
          user={{ id: "user-1", email: "slide@example.com", name: "Slide User" }}
          onBackToDashboard={vi.fn()}
          onLogout={vi.fn()}
        />
      </TooltipProvider>
    );
    await screen.findByLabelText("Drawing canvas");
    await user.click(screen.getByLabelText("Select tool"));
    await waitFor(() => {
      expect(screen.getByTestId("overlay-objects")).toHaveAttribute("data-interactive", "true");
    });
    fireEvent.paste(window, {
      clipboardData: {
        getData: () =>
          serializeElements([
            {
              id: "shape-1",
              type: "shape",
              x: 40,
              y: 50,
              width: 100,
              height: 100,
              shapeType: "hexagon",
              color: "#000000",
              strokeWidth: 2,
            },
          ]),
        files: [],
        items: [],
        types: ["text/plain"],
      },
    });
    expect(sendDrawingStart).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Delete" });
    expect(sendElementDelete).toHaveBeenCalled();
  });

  it("keeps the chosen Insert shape under + and draws it by drag", async () => {
    const sendDrawingStart = vi.fn();
    stubSocket({
      socket: { id: "sock-1" } as never,
      isConnected: true,
      sendDrawingStart,
    });
    stubBoard();
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <Whiteboard
          boardId={BOARD_ID}
          user={{ id: "user-1", email: "slide@example.com", name: "Slide User" }}
          onBackToDashboard={vi.fn()}
          onLogout={vi.fn()}
        />
      </TooltipProvider>
    );
    await screen.findByLabelText("Insert elements");
    expect(screen.queryByLabelText("Hexagon tool")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Insert elements"));
    await user.click(await screen.findByLabelText("Insert Hexagon"));
    expect(sendDrawingStart).not.toHaveBeenCalled();
    expect(await screen.findByLabelText("Hexagon tool")).toBeInTheDocument();

    const canvas = screen.getByLabelText("Drawing canvas");
    fireEvent.pointerDown(canvas, { clientX: 80, clientY: 80, button: 0, buttons: 1 });
    fireEvent.pointerMove(canvas, { clientX: 160, clientY: 150, buttons: 1 });
    fireEvent.mouseUp(window);
    expect(sendDrawingStart).toHaveBeenCalledWith(
      expect.objectContaining({ type: "shape", shapeType: "hexagon" })
    );
  });

  it("shows a drop target when dragging an image over the canvas", async () => {
    renderBoard();
    const area = await screen.findByLabelText("Whiteboard canvas area");
    fireEvent.dragEnter(area, { dataTransfer: { types: ["Files"], files: [] } });
    expect(screen.getByLabelText("Drop image to add")).toBeInTheDocument();
  });
});
