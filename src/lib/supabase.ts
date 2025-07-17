import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          avatar_url?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          avatar_url?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          avatar_url?: string
          created_at?: string
          updated_at?: string
        }
      }
      boards: {
        Row: {
          id: string
          title: string
          description?: string
          owner_id: string
          thumbnail_url?: string
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string
          owner_id: string
          thumbnail_url?: string
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          owner_id?: string
          thumbnail_url?: string
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      board_collaborators: {
        Row: {
          id: string
          board_id: string
          user_id: string
          permission: 'view' | 'edit' | 'admin'
          created_at: string
        }
        Insert: {
          id?: string
          board_id: string
          user_id: string
          permission?: 'view' | 'edit' | 'admin'
          created_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          user_id?: string
          permission?: 'view' | 'edit' | 'admin'
          created_at?: string
        }
      }
      board_elements: {
        Row: {
          id: string
          board_id: string
          type: 'drawing' | 'text' | 'shape' | 'image' | 'table' | 'chart' | 'icon'
          data: any
          position: { x: number; y: number }
          size?: { width: number; height: number }
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          board_id: string
          type: 'drawing' | 'text' | 'shape' | 'image' | 'table' | 'chart' | 'icon'
          data: any
          position: { x: number; y: number }
          size?: { width: number; height: number }
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          type?: 'drawing' | 'text' | 'shape' | 'image' | 'table' | 'chart' | 'icon'
          data?: any
          position?: { x: number; y: number }
          size?: { width: number; height: number }
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
} 