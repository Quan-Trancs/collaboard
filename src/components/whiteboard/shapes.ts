export const SHAPE_GROUPS = ["basic", "arrows", "stars", "callouts"] as const;
export type ShapeGroup = (typeof SHAPE_GROUPS)[number];

export type ShapePrimitive =
  | { kind: "path"; d: string; fillRule?: "evenodd" }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number };

export type ShapeDef = {
  id: string;
  name: string;
  group: ShapeGroup;
  keepRatio?: boolean;
  primitives: ShapePrimitive[];
};

function poly(points: Array<[number, number]>) {
  return `M${points.map(([x, y]) => `${round(x)},${round(y)}`).join(" L")} Z`;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function regular(sides: number, rotationDeg = -90, r = 46): string {
  const rot = (rotationDeg * Math.PI) / 180;
  const points: Array<[number, number]> = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = rot + (i * 2 * Math.PI) / sides;
    points.push([50 + r * Math.cos(angle), 50 + r * Math.sin(angle)]);
  }
  return poly(points);
}

function star(points: number, outer = 46, inner = 18, rotationDeg = -90): string {
  const rot = (rotationDeg * Math.PI) / 180;
  const coords: Array<[number, number]> = [];
  for (let i = 0; i < points * 2; i += 1) {
    const angle = rot + (i * Math.PI) / points;
    const radius = i % 2 === 0 ? outer : inner;
    coords.push([50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle)]);
  }
  return poly(coords);
}

function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  return [
    `M${x + radius},${y}`,
    `H${x + w - radius}`,
    `Q${x + w},${y} ${x + w},${y + radius}`,
    `V${y + h - radius}`,
    `Q${x + w},${y + h} ${x + w - radius},${y + h}`,
    `H${x + radius}`,
    `Q${x},${y + h} ${x},${y + h - radius}`,
    `V${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    "Z",
  ].join(" ");
}

export const SHAPES: ShapeDef[] = [
  { id: "rectangle", name: "Rectangle", group: "basic", primitives: [{ kind: "path", d: "M6,6 H94 V94 H6 Z" }] },
  { id: "roundedRectangle", name: "Rounded rectangle", group: "basic", primitives: [{ kind: "path", d: roundedRect(6, 6, 88, 88, 16) }] },
  { id: "ellipse", name: "Oval", group: "basic", primitives: [{ kind: "ellipse", cx: 50, cy: 50, rx: 44, ry: 32 }] },
  { id: "circle", name: "Circle", group: "basic", keepRatio: true, primitives: [{ kind: "ellipse", cx: 50, cy: 50, rx: 44, ry: 44 }] },
  { id: "triangle", name: "Triangle", group: "basic", keepRatio: true, primitives: [{ kind: "path", d: "M50,8 L94,92 L6,92 Z" }] },
  { id: "rightTriangle", name: "Right triangle", group: "basic", primitives: [{ kind: "path", d: "M8,8 L92,92 L8,92 Z" }] },
  { id: "diamond", name: "Diamond", group: "basic", keepRatio: true, primitives: [{ kind: "path", d: "M50,6 L94,50 L50,94 L6,50 Z" }] },
  { id: "pentagon", name: "Pentagon", group: "basic", keepRatio: true, primitives: [{ kind: "path", d: regular(5) }] },
  { id: "hexagon", name: "Hexagon", group: "basic", keepRatio: true, primitives: [{ kind: "path", d: regular(6, 0) }] },
  { id: "octagon", name: "Octagon", group: "basic", keepRatio: true, primitives: [{ kind: "path", d: regular(8, -22.5) }] },
  { id: "trapezoid", name: "Trapezoid", group: "basic", primitives: [{ kind: "path", d: "M22,16 H78 L94,84 H6 Z" }] },
  { id: "parallelogram", name: "Parallelogram", group: "basic", primitives: [{ kind: "path", d: "M24,16 H94 L76,84 H6 Z" }] },
  { id: "plus", name: "Plus", group: "basic", keepRatio: true, primitives: [{ kind: "path", d: "M40,8 H60 V40 H92 V60 H60 V92 H40 V60 H8 V40 H40 Z" }] },
  {
    id: "donut",
    name: "Donut",
    group: "basic",
    keepRatio: true,
    primitives: [
      {
        kind: "path",
        fillRule: "evenodd",
        d: "M50,6 A44,44 0 1 1 49.9,6 Z M50,30 A20,20 0 1 0 50.1,30 Z",
      },
    ],
  },
  {
    id: "frame",
    name: "Frame",
    group: "basic",
    primitives: [
      {
        kind: "path",
        fillRule: "evenodd",
        d: "M6,6 H94 V94 H6 Z M20,20 H80 V80 H20 Z",
      },
    ],
  },
  {
    id: "cylinder",
    name: "Cylinder",
    group: "basic",
    primitives: [
      { kind: "path", d: "M14,24 V72 A36,12 0 0 0 86,72 V24" },
      { kind: "ellipse", cx: 50, cy: 24, rx: 36, ry: 12 },
    ],
  },
  {
    id: "pie",
    name: "Pie",
    group: "basic",
    keepRatio: true,
    primitives: [{ kind: "path", d: "M50,50 L50,8 A42,42 0 1 1 8,50 Z" }],
  },
  {
    id: "rightArrow",
    name: "Right arrow",
    group: "arrows",
    primitives: [{ kind: "path", d: "M6,36 H58 V20 L94,50 L58,80 V64 H6 Z" }],
  },
  {
    id: "leftArrow",
    name: "Left arrow",
    group: "arrows",
    primitives: [{ kind: "path", d: "M94,36 H42 V20 L6,50 L42,80 V64 H94 Z" }],
  },
  {
    id: "upArrow",
    name: "Up arrow",
    group: "arrows",
    primitives: [{ kind: "path", d: "M36,94 V42 H20 L50,6 L80,42 H64 V94 Z" }],
  },
  {
    id: "downArrow",
    name: "Down arrow",
    group: "arrows",
    primitives: [{ kind: "path", d: "M36,6 V58 H20 L50,94 L80,58 H64 V6 Z" }],
  },
  {
    id: "doubleArrow",
    name: "Double arrow",
    group: "arrows",
    primitives: [{ kind: "path", d: "M6,50 L28,24 V38 H72 V24 L94,50 L72,76 V62 H28 V76 Z" }],
  },
  {
    id: "chevron",
    name: "Chevron",
    group: "arrows",
    primitives: [{ kind: "path", d: "M10,18 L52,18 L88,50 L52,82 L10,82 L46,50 Z" }],
  },
  {
    id: "bentArrow",
    name: "Bent arrow",
    group: "arrows",
    primitives: [{ kind: "path", d: "M12,28 H60 V16 L88,42 L60,68 V56 H28 V86 H12 Z" }],
  },
  {
    id: "pentagonArrow",
    name: "Pentagon arrow",
    group: "arrows",
    primitives: [{ kind: "path", d: "M8,20 H68 L94,50 L68,80 H8 Z" }],
  },
  { id: "star4", name: "4-point star", group: "stars", keepRatio: true, primitives: [{ kind: "path", d: star(4, 46, 16) }] },
  { id: "star", name: "5-point star", group: "stars", keepRatio: true, primitives: [{ kind: "path", d: star(5) }] },
  { id: "star6", name: "6-point star", group: "stars", keepRatio: true, primitives: [{ kind: "path", d: star(6, 46, 20) }] },
  { id: "star8", name: "8-point star", group: "stars", keepRatio: true, primitives: [{ kind: "path", d: star(8, 46, 22) }] },
  { id: "burst", name: "Burst", group: "stars", keepRatio: true, primitives: [{ kind: "path", d: star(12, 46, 26) }] },
  {
    id: "heart",
    name: "Heart",
    group: "stars",
    keepRatio: true,
    primitives: [
      {
        kind: "path",
        d: "M50,88 C22,66 8,48 8,32 C8,18 20,10 32,10 C40,10 46,14 50,22 C54,14 60,10 68,10 C80,10 92,18 92,32 C92,48 78,66 50,88 Z",
      },
    ],
  },
  {
    id: "speech",
    name: "Speech bubble",
    group: "callouts",
    primitives: [
      { kind: "path", d: roundedRect(8, 8, 84, 58, 10) },
      { kind: "path", d: "M28,66 L20,90 L50,66 Z" },
    ],
  },
  {
    id: "roundedSpeech",
    name: "Rounded callout",
    group: "callouts",
    primitives: [
      { kind: "ellipse", cx: 50, cy: 42, rx: 40, ry: 28 },
      { kind: "path", d: "M36,66 L28,90 L56,66 Z" },
    ],
  },
  {
    id: "cloud",
    name: "Cloud",
    group: "callouts",
    keepRatio: true,
    primitives: [
      {
        kind: "path",
        d: "M22,64 C10,64 8,50 20,46 C18,30 40,24 48,36 C56,22 82,28 80,44 C94,46 94,64 80,66 H24 C22,66 22,64 22,64 Z",
      },
    ],
  },
  {
    id: "thought",
    name: "Thought bubble",
    group: "callouts",
    keepRatio: true,
    primitives: [
      {
        kind: "path",
        d: "M24,52 C12,52 10,38 22,34 C20,20 42,16 50,26 C58,14 80,20 78,34 C90,36 90,52 78,54 H26 Z",
      },
      { kind: "ellipse", cx: 30, cy: 72, rx: 7, ry: 6 },
      { kind: "ellipse", cx: 20, cy: 86, rx: 4.5, ry: 4 },
    ],
  },
  {
    id: "lightning",
    name: "Lightning",
    group: "stars",
    keepRatio: true,
    primitives: [{ kind: "path", d: "M58,6 L24,52 H46 L38,94 L78,42 H54 Z" }],
  },
  {
    id: "ribbon",
    name: "Banner",
    group: "callouts",
    primitives: [{ kind: "path", d: "M8,28 H92 L82,50 L92,72 H8 L18,50 Z" }],
  },
  {
    id: "moon",
    name: "Moon",
    group: "stars",
    keepRatio: true,
    primitives: [
      {
        kind: "path",
        fillRule: "evenodd",
        d: "M50,8 A42,42 0 1 1 49.9,8 Z M64,20 A32,32 0 1 1 63.9,20 Z",
      },
    ],
  },
];

const ALIASES: Record<string, string> = {
  arrow: "rightArrow",
  oval: "ellipse",
};

export const SHAPE_IDS = SHAPES.map((shape) => shape.id) as [string, ...string[]];

const SHAPE_BY_ID = new Map(SHAPES.map((shape) => [shape.id, shape]));

export function getShape(type: string | undefined): ShapeDef {
  const id = type ? ALIASES[type] || type : "rectangle";
  return SHAPE_BY_ID.get(id) || SHAPE_BY_ID.get("rectangle")!;
}

export function shapesInGroup(group: ShapeGroup) {
  return SHAPES.filter((shape) => shape.group === group);
}

export const SHAPE_GROUP_LABELS: Record<ShapeGroup, string> = {
  basic: "Basic",
  arrows: "Arrows",
  stars: "Stars and symbols",
  callouts: "Callouts",
};
