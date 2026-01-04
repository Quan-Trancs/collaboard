/**
 * API functions
 * 
 * Connects to the backend Express API with MongoDB
 * Uses enhanced API client with retry logic and caching
 */

import { apiRequest, ApiError, clearCache } from './apiClient';
import type { User, Board, BoardElement } from '@/types';

/**
 * User API functions
 */
export const userApi = {
  async getCurrentUser(): Promise<User | null> {
    try {
      return await apiRequest<User>('/auth/me', { useCache: true, cacheTTL: 2 * 60 * 1000 });
    } catch (error) {
      // Do not remove token on API failures - let user handle it explicitly
      return null;
    }
  },

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const result = await apiRequest<User>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    // Clear user cache after update
    clearCache('/auth/me');
    return result;
  },
};

/**
 * Board API functions
 */
export const boardApi = {
  async getBoards(): Promise<Board[]> {
    try {
      return await apiRequest<Board[]>('/boards', { 
        useCache: true, 
        cacheTTL: 30 * 1000 // 30 seconds cache
      });
    } catch (error) {
      // Do not remove token on API failures - let user handle it explicitly
      return [];
    }
  },

  async getBoard(id: string): Promise<Board & { elements: BoardElement[] }> {
    return await apiRequest<Board & { elements: BoardElement[] }>(`/boards/${id}`, {
      useCache: true,
      cacheTTL: 10 * 1000, // 10 seconds cache
    });
  },

  async createBoard(boardData: { title: string; description?: string; is_public?: boolean }): Promise<Board> {
    const result = await apiRequest<Board>('/boards', {
      method: 'POST',
      body: JSON.stringify(boardData),
    });
    // Clear boards list cache
    clearCache('/boards');
    return result;
  },

  async updateBoard(id: string, updates: Partial<Board>): Promise<Board> {
    const result = await apiRequest<Board>(`/boards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    // Clear caches
    clearCache('/boards');
    clearCache(`/boards/${id}`);
    return result;
  },

  async deleteBoard(id: string): Promise<void> {
    await apiRequest(`/boards/${id}`, {
      method: 'DELETE',
    });
    // Clear caches
    clearCache('/boards');
    clearCache(`/boards/${id}`);
  },

  async addCollaborator(boardId: string, email: string, permission: 'view' | 'edit' | 'admin' = 'view'): Promise<void> {
    await apiRequest(`/boards/${boardId}/collaborators`, {
      method: 'POST',
      body: JSON.stringify({ email, permission }),
    });
    // Clear board cache
    clearCache(`/boards/${boardId}`);
  },

  async removeCollaborator(boardId: string, userId: string): Promise<void> {
    await apiRequest(`/boards/${userId}/collaborators/${userId}`, {
      method: 'DELETE',
    });
    // Clear board cache
    clearCache(`/boards/${userId}`);
  },

  async updateCollaboratorPermission(boardId: string, userId: string, permission: 'view' | 'edit' | 'admin'): Promise<void> {
    // Use addCollaborator which upserts
    await this.addCollaborator(boardId, '', permission);
  },
};

/**
 * Board Elements API functions
 */
export const elementApi = {
  async getElements(boardId: string): Promise<BoardElement[]> {
    try {
      return await apiRequest<BoardElement[]>(`/elements/board/${boardId}`, {
        useCache: true,
        cacheTTL: 5 * 1000, // 5 seconds cache for elements
      });
    } catch (error) {
      return [];
    }
  },

  async createElement(elementData: {
    board_id: string;
    type: 'drawing' | 'text' | 'shape' | 'image' | 'table' | 'chart' | 'icon';
    data: Record<string, any>;
    position: { x: number; y: number };
    size?: { width: number; height: number };
  }): Promise<BoardElement> {
    const result = await apiRequest<BoardElement>('/elements', {
      method: 'POST',
      body: JSON.stringify(elementData),
    });
    // Clear elements cache for this board
    clearCache(`/elements/board/${elementData.board_id}`);
    return result;
  },

  async updateElement(id: string, updates: Partial<BoardElement>): Promise<BoardElement> {
    const result = await apiRequest<BoardElement>(`/elements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    // Clear elements cache if board_id is in updates
    if (updates.board_id) {
      clearCache(`/elements/board/${updates.board_id}`);
    }
    return result;
  },

  async deleteElement(id: string, boardId?: string): Promise<void> {
    await apiRequest(`/elements/${id}`, {
      method: 'DELETE',
    });
    // Clear elements cache if boardId provided
    if (boardId) {
      clearCache(`/elements/board/${boardId}`);
    }
  },

  async batchUpdateElements(boardId: string, elements: Array<{ id: string; updates: Partial<BoardElement> }>): Promise<void> {
    // Transform to batch-save format
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
    // Clear elements cache
    clearCache(`/elements/board/${boardId}`);
  },
};

/**
 * Real-time subscription helpers (stubs - WebSocket handled by Socket.IO)
 */
export const realtimeApi = {
  subscribeToBoard(boardId: string, callback: (payload: any) => void) {
    // Real-time is handled by Socket.IO, not needed here
    return { unsubscribe: () => {} };
  },

  subscribeToBoardMetadata(boardId: string, callback: (payload: any) => void) {
    return { unsubscribe: () => {} };
  },

  subscribeToCollaborators(boardId: string, callback: (payload: any) => void) {
    return { unsubscribe: () => {} };
  },
};
