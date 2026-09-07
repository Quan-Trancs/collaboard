import { useEffect, useRef, useState } from "react";

type WorldPosition = { x: number; y: number };

export function useWorldDrag(
  element: WorldPosition,
  zoom: number,
  onMove: (x: number, y: number) => void,
  onDragEnd: () => void,
  onSelect: () => void,
  enabled = true
) {
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef({ clientX: 0, clientY: 0, x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    if (!enabled || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    startRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      x: element.x,
      y: element.y,
    };
    setIsDragging(true);
    onSelect();
  };

  useEffect(() => {
    if (!isDragging) return;
    const scale = zoom || 1;

    const onMoveDoc = (event: MouseEvent) => {
      const x = startRef.current.x + (event.clientX - startRef.current.clientX) / scale;
      const y = startRef.current.y + (event.clientY - startRef.current.clientY) / scale;
      onMove(x, y);
    };

    const onUp = () => {
      setIsDragging(false);
      onDragEnd();
    };

    document.addEventListener("mousemove", onMoveDoc);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMoveDoc);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, zoom, onMove, onDragEnd]);

  return { isDragging, onMouseDown };
}
