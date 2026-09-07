/**
 * API functions
 *
 * Connects to the backend Express API with MongoDB
 * Uses enhanced API client with retry logic and caching
 */

import { apiRequest, clearCache } from './apiClient';
import type { User, Board, BoardElement, SlideObject, InkStroke, BoardViewport, BoardBackground, BoardShareInfo, Collaborator } from '@/types';

export const userApi = {
  async getCurrentUser(): Promise<User | null> {
    try {
      return await apiRequest<User>('/auth/me', { useCache: true, cacheTTL: 2 * 60 * 1000 });
    } catch (error) {
      return null;
    }
  },

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const result = await apiRequest<User>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    clearCache('/auth/me');
    return result;
  },
};

export const boardApi = {
  async getBoards(): Promise<Board[]> {
    return await apiRequest<Board[]>('/boards');
  },

  async getBoard(id: string): Promise<Board & { objects: SlideObject[]; drawings: InkStroke[] }> {
    return await apiRequest<Board & { objects: SlideObject[]; drawings: InkStroke[] }>(`/boards/${id}`, {
      useCache: true,
      cacheTTL: 10 * 1000,
    });
  },

  async createBoard(boardData: { title: string; description?: string; is_public?: boolean }): Promise<Board> {
    const result = await apiRequest<Board>('/boards', {
      method: 'POST',
      body: JSON.stringify(boardData),
    });
    clearCache('/boards');
    return result;
  },

  async updateBoard(
    id: string,
    updates: Partial<Board> & { viewport?: BoardViewport; background?: BoardBackground }
  ): Promise<Board> {
    const result = await apiRequest<Board>(`/boards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    clearCache('/boards');
    clearCache(`/boards/${id}`);
    return result;
  },

  async deleteBoard(id: string): Promise<void> {
    await apiRequest(`/boards/${id}`, {
      method: 'DELETE',
    });
    clearCache('/boards');
    clearCache(`/boards/${id}`);
  },

  async getCollaborators(boardId: string): Promise<BoardShareInfo> {
    return await apiRequest<BoardShareInfo>(`/boards/${boardId}/collaborators`);
  },

  async addCollaborator(boardId: string, email: string, permission: 'view' | 'edit' | 'admin' = 'view'): Promise<Collaborator> {
    const result = await apiRequest<Collaborator>(`/boards/${boardId}/collaborators`, {
      method: 'POST',
      body: JSON.stringify({ email, permission }),
    });
    clearCache('/boards');
    clearCache(`/boards/${boardId}`);
    return result;
  },

  async removeCollaborator(boardId: string, userId: string): Promise<void> {
    await apiRequest(`/boards/${boardId}/collaborators/${userId}`, {
      method: 'DELETE',
    });
    clearCache('/boards');
    clearCache(`/boards/${boardId}`);
  },

  async updateCollaboratorPermission(boardId: string, userId: string, permission: 'view' | 'edit' | 'admin'): Promise<Collaborator> {
    const result = await apiRequest<Collaborator>(`/boards/${boardId}/collaborators/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ permission }),
    });
    clearCache('/boards');
    clearCache(`/boards/${boardId}`);
    return result;
  },
};

export const objectApi = {
  async getObjects(boardId: string): Promise<SlideObject[]> {
    try {
      return await apiRequest<SlideObject[]>(`/objects/board/${boardId}`, {
        useCache: true,
        cacheTTL: 5 * 1000,
      });
    } catch (error) {
      return [];
    }
  },

  async createObject(objectData: {
    board_id: string;
    type: SlideObject['type'];
    transform: SlideObject['transform'];
    zIndex?: number;
    locked?: boolean;
    visible?: boolean;
    props?: Record<string, unknown>;
  }): Promise<SlideObject> {
    const result = await apiRequest<SlideObject>('/objects', {
      method: 'POST',
      body: JSON.stringify(objectData),
    });
    clearCache(`/objects/board/${objectData.board_id}`);
    return result;
  },

  async updateObject(id: string, updates: Partial<Pick<SlideObject, 'transform' | 'zIndex' | 'locked' | 'visible' | 'props'>>, boardId?: string): Promise<SlideObject> {
    const result = await apiRequest<SlideObject>(`/objects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (boardId) clearCache(`/objects/board/${boardId}`);
    return result;
  },

  async deleteObject(id: string, boardId?: string): Promise<void> {
    await apiRequest(`/objects/${id}`, { method: 'DELETE' });
    if (boardId) clearCache(`/objects/board/${boardId}`);
  },
};

export const drawingApi = {
  async getDrawings(boardId: string): Promise<InkStroke[]> {
    try {
      return await apiRequest<InkStroke[]>(`/drawings/board/${boardId}`, {
        useCache: true,
        cacheTTL: 5 * 1000,
      });
    } catch (error) {
      return [];
    }
  },

  async createStroke(stroke: {
    board_id: string;
    points: Array<{ x: number; y: number }>;
    color: string;
    strokeWidth: number;
  }): Promise<InkStroke> {
    const result = await apiRequest<InkStroke>('/drawings', {
      method: 'POST',
      body: JSON.stringify(stroke),
    });
    clearCache(`/drawings/board/${stroke.board_id}`);
    return result;
  },

  async batchSave(boardId: string, strokes: Array<{
    id?: string;
    points: Array<{ x: number; y: number }>;
    color: string;
    strokeWidth: number;
  }>): Promise<void> {
    await apiRequest('/drawings/batch-save', {
      method: 'POST',
      body: JSON.stringify({ boardId, strokes }),
    });
    clearCache(`/drawings/board/${boardId}`);
  },

  async deleteStroke(id: string, boardId?: string): Promise<void> {
    await apiRequest(`/drawings/${id}`, { method: 'DELETE' });
    if (boardId) clearCache(`/drawings/board/${boardId}`);
  },
};

/** Legacy mixed element API — prefers the adapter that writes SlideObject / InkStroke. */
export const elementApi = {
  async getElements(boardId: string): Promise<BoardElement[]> {
    try {
      return await apiRequest<BoardElement[]>(`/elements/board/${boardId}`, {
        useCache: true,
        cacheTTL: 5 * 1000,
      });
    } catch (error) {
      return [];
    }
  },

  async createElement(elementData: {
    board_id: string;
    type: BoardElement['type'];
    data: Record<string, any>;
    position: { x: number; y: number };
    size?: { width: number; height: number };
  }): Promise<BoardElement> {
    const result = await apiRequest<BoardElement>('/elements', {
      method: 'POST',
      body: JSON.stringify(elementData),
    });
    clearCache(`/elements/board/${elementData.board_id}`);
    return result;
  },

  async updateElement(id: string, updates: Partial<BoardElement>): Promise<BoardElement> {
    const result = await apiRequest<BoardElement>(`/elements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (updates.board_id) {
      clearCache(`/elements/board/${updates.board_id}`);
    }
    return result;
  },

  async deleteElement(id: string, boardId?: string): Promise<void> {
    await apiRequest(`/elements/${id}`, {
      method: 'DELETE',
    });
    if (boardId) {
      clearCache(`/elements/board/${boardId}`);
    }
  },

  async batchUpdateElements(boardId: string, elements: Array<{ id: string; updates: Partial<BoardElement> }>): Promise<void> {
    const batchElements = elements.map(({ id, updates }) => ({
      id,
      type: updates.type!,
      data: updates.data!,
      position: updates.position!,
      size: updates.size,
    }));

    await apiRequest('/elements/batch-save', {
      method: 'POST',
      body: JSON.stringify({
        boardId,
        elements: batchElements,
      }),
    });
    clearCache(`/elements/board/${boardId}`);
  },
};

export const realtimeApi = {
  subscribeToBoard(boardId: string, callback: (payload: any) => void) {
    return { unsubscribe: () => {} };
  },

  subscribeToBoardMetadata(boardId: string, callback: (payload: any) => void) {
    return { unsubscribe: () => {} };
  },

  subscribeToCollaborators(boardId: string, callback: (payload: any) => void) {
    return { unsubscribe: () => {} };
  },
};
