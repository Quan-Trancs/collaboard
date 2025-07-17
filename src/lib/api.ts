import { supabase } from './supabase'
import type { Database } from './supabase'

type User = Database['public']['Tables']['users']['Row']
type Board = Database['public']['Tables']['boards']['Row']
type BoardCollaborator = Database['public']['Tables']['board_collaborators']['Row']
type BoardElement = Database['public']['Tables']['board_elements']['Row']

// User API functions
export const userApi = {
  // Get current user
  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) throw error
    return data
  },

  // Create or update user profile
  async upsertUser(userData: { id: string; email: string; name: string; avatar_url?: string }): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .upsert(userData, { onConflict: 'id' })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Update user profile
  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }
}

// Board API functions
export const boardApi = {
  // Get all boards for current user
  async getBoards(): Promise<Board[]> {
    const { data, error } = await supabase
      .from('boards')
      .select(`
        *,
        owner:users!boards_owner_id_fkey(name, email),
        collaborators:board_collaborators(
          user:users!board_collaborators_user_id_fkey(name, email)
        )
      `)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Get single board with elements
  async getBoard(id: string): Promise<Board & { elements: BoardElement[] }> {
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select(`
        *,
        owner:users!boards_owner_id_fkey(name, email),
        collaborators:board_collaborators(
          user:users!board_collaborators_user_id_fkey(name, email)
        )
      `)
      .eq('id', id)
      .single()

    if (boardError) throw boardError

    const { data: elements, error: elementsError } = await supabase
      .from('board_elements')
      .select('*')
      .eq('board_id', id)
      .order('created_at', { ascending: true })

    if (elementsError) throw elementsError

    return {
      ...board,
      elements: elements || []
    }
  },

  // Create new board
  async createBoard(boardData: { title: string; description?: string; is_public?: boolean }): Promise<Board> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('boards')
      .insert({
        ...boardData,
        owner_id: user.id
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Update board
  async updateBoard(id: string, updates: Partial<Board>): Promise<Board> {
    const { data, error } = await supabase
      .from('boards')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Delete board
  async deleteBoard(id: string): Promise<void> {
    const { error } = await supabase
      .from('boards')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Add collaborator to board
  async addCollaborator(boardId: string, email: string, permission: 'view' | 'edit' | 'admin' = 'view'): Promise<void> {
    // First find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (userError) throw new Error('User not found')

    const { error } = await supabase
      .from('board_collaborators')
      .insert({
        board_id: boardId,
        user_id: user.id,
        permission
      })

    if (error) throw error
  },

  // Remove collaborator from board
  async removeCollaborator(boardId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('board_collaborators')
      .delete()
      .eq('board_id', boardId)
      .eq('user_id', userId)

    if (error) throw error
  },

  // Update collaborator permission
  async updateCollaboratorPermission(boardId: string, userId: string, permission: 'view' | 'edit' | 'admin'): Promise<void> {
    const { error } = await supabase
      .from('board_collaborators')
      .update({ permission })
      .eq('board_id', boardId)
      .eq('user_id', userId)

    if (error) throw error
  }
}

// Board Elements API functions
export const elementApi = {
  // Get elements for a board
  async getElements(boardId: string): Promise<BoardElement[]> {
    const { data, error } = await supabase
      .from('board_elements')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  // Create new element
  async createElement(elementData: {
    board_id: string
    type: 'drawing' | 'text' | 'shape' | 'image' | 'table' | 'chart' | 'icon'
    data: any
    position: { x: number; y: number }
    size?: { width: number; height: number }
  }): Promise<BoardElement> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('board_elements')
      .insert({
        ...elementData,
        created_by: user.id
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Update element
  async updateElement(id: string, updates: Partial<BoardElement>): Promise<BoardElement> {
    const { data, error } = await supabase
      .from('board_elements')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Delete element
  async deleteElement(id: string): Promise<void> {
    const { error } = await supabase
      .from('board_elements')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Batch update elements (for real-time collaboration)
  async batchUpdateElements(elements: Array<{ id: string; updates: Partial<BoardElement> }>): Promise<void> {
    const { error } = await supabase
      .from('board_elements')
      .upsert(
        elements.map(({ id, updates }) => ({ id, ...updates })),
        { onConflict: 'id' }
      )

    if (error) throw error
  }
}

// Real-time subscription helpers
export const realtimeApi = {
  // Subscribe to board changes
  subscribeToBoard(boardId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`board:${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'board_elements',
          filter: `board_id=eq.${boardId}`
        },
        callback
      )
      .subscribe()
  },

  // Subscribe to board metadata changes
  subscribeToBoardMetadata(boardId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`board-metadata:${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'boards',
          filter: `id=eq.${boardId}`
        },
        callback
      )
      .subscribe()
  },

  // Subscribe to collaborator changes
  subscribeToCollaborators(boardId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`collaborators:${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'board_collaborators',
          filter: `board_id=eq.${boardId}`
        },
        callback
      )
      .subscribe()
  }
} 