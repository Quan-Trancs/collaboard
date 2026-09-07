import { getShape, type ShapePrimitive } from "./shapes";

interface ShapeGraphicProps {
  type?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
  title?: string;
}

function paint(fill?: string) {
  if (!fill || fill === "transparent" || fill === "none") return "none";
  return fill;
}

function Primitive({
  primitive,
  fill,
  stroke,
  strokeWidth,
}: {
  primitive: ShapePrimitive;
  fill: string;
  stroke: string;
  strokeWidth: number;
}) {
  const common = {
    fill,
    stroke,
    strokeWidth,
    strokeLinejoin: "round" as const,
    vectorEffect: "non-scaling-stroke" as const,
  };
  if (primitive.kind === "ellipse") {
    return <ellipse cx={primitive.cx} cy={primitive.cy} rx={primitive.rx} ry={primitive.ry} {...common} />;
  }
  return <path d={primitive.d} fillRule={primitive.fillRule} {...common} />;
}

export default function ShapeGraphic({
  type,
  fill = "transparent",
  stroke = "#111827",
  strokeWidth = 2,
  className,
  title,
}: ShapeGraphicProps) {
  const shape = getShape(type);
  const fillPaint = paint(fill);
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio={shape.keepRatio ? "xMidYMid meet" : "none"}
      className={className}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {shape.primitives.map((primitive, index) => (
        <Primitive
          key={index}
          primitive={primitive}
          fill={fillPaint}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      ))}
    </svg>
  );
}
