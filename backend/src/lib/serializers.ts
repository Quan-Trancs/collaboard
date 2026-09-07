export function serializeSlideObject(doc: any) {
  const id = doc._id?.toString?.() || doc.id;
  const createdAt = doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.created_at;
  const updatedAt = doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updated_at;
  return {
    id: doc.client_id || id,
    board_id: doc.board_id?.toString?.() || doc.board_id,
    type: doc.type,
    transform: doc.transform,
    zIndex: doc.zIndex ?? 0,
    locked: doc.locked ?? false,
    visible: doc.visible ?? true,
    props: doc.props || {},
    created_by: doc.created_by?.toString?.() || doc.created_by,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function serializeInkStroke(doc: any) {
  const id = doc._id?.toString?.() || doc.id;
  const createdAt = doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.created_at;
  const updatedAt = doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updated_at;
  return {
    id: doc.client_id || id,
    board_id: doc.board_id?.toString?.() || doc.board_id,
    type: 'drawing' as const,
    points: doc.points || [],
    color: doc.color,
    strokeWidth: doc.strokeWidth,
    created_by: doc.created_by?.toString?.() || doc.created_by,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function serializeBoard(board: Record<string, any>) {
  return {
    id: board._id.toString(),
    title: board.title,
    description: board.description,
    owner_id: board.owner_id.toString(),
    thumbnail_url: board.thumbnail_url,
    is_public: board.is_public,
    background: board.background || { color: '#ffffff', image: null },
    viewport: board.viewport || { x: -2000, y: -2000, zoom: 1 },
    created_at: board.createdAt.toISOString(),
    updated_at: board.updatedAt.toISOString(),
  };
}
