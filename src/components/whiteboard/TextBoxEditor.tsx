import { useEffect, useRef } from "react";
import {
  MIN_TEXT_BOX_HEIGHT,
  MIN_TEXT_BOX_WIDTH,
  TEXT_BOX_PADDING,
  cssFont,
  cssTextDecoration,
  type TextStyle,
} from "./textStyle";

type ResizeEdge = "e" | "s" | "se";

interface TextBoxEditorProps {
  x: number;
  y: number;
  width: number;
  height: number;
  value: string;
  style: TextStyle;
  color: string;
  zoom: number;
  highlightLayout: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onResize: (width: number, height: number) => void;
  onResizeEnd: () => void;
}

export default function TextBoxEditor({
  x,
  y,
  width,
  height,
  value,
  style,
  color,
  zoom,
  highlightLayout,
  onChange,
  onCommit,
  onCancel,
  onResize,
  onResizeEnd,
}: TextBoxEditorProps) {
  const boxRef = useRef({ width, height });
  boxRef.current = { width, height };
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizingRef = useRef(false);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const startResize = (edge: ResizeEdge) => (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    resizingRef.current = true;
    const startX = event.clientX;
    const startY = event.clientY;
    const startW = boxRef.current.width;
    const startH = boxRef.current.height;
    const scale = zoom || 1;

    const onMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;
      const nextWidth = edge === "s" ? startW : Math.max(MIN_TEXT_BOX_WIDTH, startW + dx);
      const nextHeight = edge === "e" ? startH : Math.max(MIN_TEXT_BOX_HEIGHT, startH + dy);
      onResize(nextWidth, nextHeight);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      onResizeEnd();
      requestAnimationFrame(() => {
        resizingRef.current = false;
        textareaRef.current?.focus();
      });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const handleSize = 8 / zoom;

  return (
    <div
      className="absolute z-20"
      aria-label="Text box editor"
      style={{
        left: x,
        top: y,
        width,
        height,
        background: "#ffffff",
        border: `${1.5 / zoom}px solid #3B82F6`,
        boxShadow: highlightLayout ? `inset 0 0 0 ${1 / zoom}px rgba(56, 189, 248, 0.7)` : "0 4px 16px rgba(15, 23, 42, 0.08)",
        boxSizing: "border-box",
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onCommit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onBlur={() => {
          requestAnimationFrame(() => {
            if (!resizingRef.current) onCommit();
          });
        }}
        placeholder="Type text..."
        aria-label="Text box input"
        style={{
          width: "100%",
          height: "100%",
          margin: 0,
          padding: TEXT_BOX_PADDING,
          border: "none",
          outline: "none",
          resize: "none",
          overflow: "auto",
          background: "transparent",
          color,
          caretColor: color,
          font: cssFont(style),
          lineHeight: style.lineHeight,
          textAlign: style.align,
          textDecoration: cssTextDecoration(style),
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          boxSizing: "border-box",
        }}
      />
      {highlightLayout && (
        <div
          className="pointer-events-none absolute border border-dashed border-sky-400/80"
          aria-hidden
          style={{
            left: TEXT_BOX_PADDING,
            top: TEXT_BOX_PADDING,
            right: TEXT_BOX_PADDING,
            bottom: TEXT_BOX_PADDING,
          }}
        />
      )}
      <span
        className="pointer-events-none absolute text-sky-600"
        style={{
          left: 0,
          top: height + 4 / zoom,
          fontSize: 11 / zoom,
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        {Math.round(width)} × {Math.round(height)} px
      </span>
      {(["e", "s", "se"] as const).map((edge) => (
        <button
          key={edge}
          type="button"
          aria-label={edge === "se" ? "Resize text box" : `Resize text box ${edge === "e" ? "width" : "height"}`}
          className="absolute bg-white border border-blue-500 p-0"
          style={{
            width: handleSize,
            height: handleSize,
            right: edge === "s" ? "50%" : -handleSize / 2,
            bottom: edge === "e" ? "50%" : -handleSize / 2,
            transform: edge === "s" ? "translateX(50%)" : edge === "e" ? "translateY(50%)" : undefined,
            cursor: edge === "e" ? "ew-resize" : edge === "s" ? "ns-resize" : "nwse-resize",
          }}
          onMouseDown={startResize(edge)}
        />
      ))}
    </div>
  );
}

interface TextBoxHandlesProps {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  highlightLayout: boolean;
  onResize: (width: number, height: number) => void;
  onResizeEnd: () => void;
}

export function TextBoxHandles({
  x,
  y,
  width,
  height,
  zoom,
  highlightLayout,
  onResize,
  onResizeEnd,
}: TextBoxHandlesProps) {
  const boxRef = useRef({ width, height });
  boxRef.current = { width, height };
  const handleSize = 8 / zoom;

  const startResize = (edge: ResizeEdge) => (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const startW = boxRef.current.width;
    const startH = boxRef.current.height;
    const scale = zoom || 1;

    const onMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;
      const nextWidth = edge === "s" ? startW : Math.max(MIN_TEXT_BOX_WIDTH, startW + dx);
      const nextHeight = edge === "e" ? startH : Math.max(MIN_TEXT_BOX_HEIGHT, startH + dy);
      onResize(nextWidth, nextHeight);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      onResizeEnd();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div
      className="absolute z-10 pointer-events-none"
      aria-hidden={!highlightLayout}
      style={{ left: x, top: y, width, height }}
    >
      {highlightLayout && (
        <span
          className="absolute text-sky-600"
          style={{
            left: 0,
            top: height + 4 / zoom,
            fontSize: 11 / zoom,
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          {Math.round(width)} × {Math.round(height)} px
        </span>
      )}
      {(["e", "s", "se"] as const).map((edge) => (
        <button
          key={edge}
          type="button"
          aria-label={edge === "se" ? "Resize text box" : `Resize text box ${edge === "e" ? "width" : "height"}`}
          className="absolute bg-white border border-blue-500 p-0 pointer-events-auto"
          style={{
            width: handleSize,
            height: handleSize,
            right: edge === "s" ? "50%" : -handleSize / 2,
            bottom: edge === "e" ? "50%" : -handleSize / 2,
            transform: edge === "s" ? "translateX(50%)" : edge === "e" ? "translateY(50%)" : undefined,
            cursor: edge === "e" ? "ew-resize" : edge === "s" ? "ns-resize" : "nwse-resize",
          }}
          onMouseDown={startResize(edge)}
        />
      ))}
    </div>
  );
}
