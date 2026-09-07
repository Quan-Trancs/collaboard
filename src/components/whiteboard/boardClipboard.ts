import type { DrawingElement } from "@/types";

export const CLIPBOARD_KIND = "collaboard/elements";
export const PASTE_OFFSET = 24;
export const MAX_IMAGE_EDGE = 480;

export type ClipboardElement = Pick<DrawingElement, "id" | "type" | "x" | "y"> &
  Partial<Omit<DrawingElement, "id" | "type" | "x" | "y">>;

export function toDrawingElements(elements: ClipboardElement[]): DrawingElement[] {
  return elements.map((element) => ({
    color: "#000000",
    strokeWidth: 1,
    ...element,
  }));
}

export function newElementId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || Boolean(target.closest("[contenteditable=true]"));
}

export function cloneElements<T extends ClipboardElement>(elements: T[], offset = PASTE_OFFSET): T[] {
  return elements.map((element) => ({
    ...element,
    id: newElementId(),
    x: element.x + offset,
    y: element.y + offset,
    points: element.points?.map((point) => ({ x: point.x + offset, y: point.y + offset })),
  }));
}

export function serializeElements(elements: ClipboardElement[]) {
  return JSON.stringify({ kind: CLIPBOARD_KIND, elements });
}

export function parseClipboardText(text: string | undefined | null): ClipboardElement[] | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed?.kind !== CLIPBOARD_KIND || !Array.isArray(parsed.elements)) return null;
    return parsed.elements.filter((element: unknown) => element && typeof element === "object" && typeof (element as ClipboardElement).id === "string");
  } catch {
    return null;
  }
}

export function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

export function fitImageSize(width: number, height: number, maxEdge = MAX_IMAGE_EDGE) {
  const safeW = Number.isFinite(width) && width > 0 ? width : 200;
  const safeH = Number.isFinite(height) && height > 0 ? height : 150;
  const scale = Math.min(1, maxEdge / Math.max(safeW, safeH));
  return {
    width: Math.max(40, Math.round(safeW * scale)),
    height: Math.max(40, Math.round(safeH * scale)),
  };
}

export function readImageFile(file: File): Promise<{ src: string; name: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
      const src = String(reader.result || "");
      const image = new Image();
      image.onload = () => {
        resolve({
          src,
          name: file.name || "image",
          width: image.naturalWidth || 200,
          height: image.naturalHeight || 150,
        });
      };
      image.onerror = () => {
        resolve({ src, name: file.name || "image", width: 200, height: 150 });
      };
      image.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export function dataTransferHasFiles(dataTransfer: DataTransfer | null | undefined) {
  if (!dataTransfer) return false;
  return Array.from(dataTransfer.types || []).includes("Files");
}
