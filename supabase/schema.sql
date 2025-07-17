-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create boards table
CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thumbnail_url TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create board_collaborators table
CREATE TABLE IF NOT EXISTS board_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT CHECK (permission IN ('view', 'edit', 'admin')) DEFAULT 'view',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(board_id, user_id)
);

-- Create board_elements table
CREATE TABLE IF NOT EXISTS board_elements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('drawing', 'text', 'shape', 'image', 'table', 'chart', 'icon')),
  data JSONB NOT NULL,
  position JSONB NOT NULL,
  size JSONB,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_boards_owner_id ON boards(owner_id);
CREATE INDEX IF NOT EXISTS idx_board_collaborators_board_id ON board_collaborators(board_id);
CREATE INDEX IF NOT EXISTS idx_board_collaborators_user_id ON board_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_board_elements_board_id ON board_elements(board_id);
CREATE INDEX IF NOT EXISTS idx_board_elements_created_by ON board_elements(created_by);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_boards_updated_at BEFORE UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_board_elements_updated_at BEFORE UPDATE ON board_elements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create RLS (Row Level Security) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_elements ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT WITH CHECK (auth.uid()::text = id::text);

-- Boards policies
CREATE POLICY "Users can view boards they own or collaborate on" ON boards
  FOR SELECT USING (
    owner_id::text = auth.uid()::text OR
    id IN (
      SELECT board_id FROM board_collaborators 
      WHERE user_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert boards they own" ON boards
  FOR INSERT WITH CHECK (owner_id::text = auth.uid()::text);

CREATE POLICY "Users can update boards they own or have admin access" ON boards
  FOR UPDATE USING (
    owner_id::text = auth.uid()::text OR
    id IN (
      SELECT board_id FROM board_collaborators 
      WHERE user_id::text = auth.uid()::text AND permission = 'admin'
    )
  );

CREATE POLICY "Users can delete boards they own" ON boards
  FOR DELETE USING (owner_id::text = auth.uid()::text);

-- Board collaborators policies
CREATE POLICY "Users can view collaborators of boards they have access to" ON board_collaborators
  FOR SELECT USING (
    board_id IN (
      SELECT id FROM boards 
      WHERE owner_id::text = auth.uid()::text
    ) OR
    board_id IN (
      SELECT board_id FROM board_collaborators 
      WHERE user_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Board owners can manage collaborators" ON board_collaborators
  FOR ALL USING (
    board_id IN (
      SELECT id FROM boards 
      WHERE owner_id::text = auth.uid()::text
    )
  );

-- Board elements policies
CREATE POLICY "Users can view elements of boards they have access to" ON board_elements
  FOR SELECT USING (
    board_id IN (
      SELECT id FROM boards 
      WHERE owner_id::text = auth.uid()::text
    ) OR
    board_id IN (
      SELECT board_id FROM board_collaborators 
      WHERE user_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert elements to boards they have edit access to" ON board_elements
  FOR INSERT WITH CHECK (
    board_id IN (
      SELECT id FROM boards 
      WHERE owner_id::text = auth.uid()::text
    ) OR
    board_id IN (
      SELECT board_id FROM board_collaborators 
      WHERE user_id::text = auth.uid()::text AND permission IN ('edit', 'admin')
    )
  );

CREATE POLICY "Users can update elements they created or have edit access" ON board_elements
  FOR UPDATE USING (
    created_by::text = auth.uid()::text OR
    board_id IN (
      SELECT id FROM boards 
      WHERE owner_id::text = auth.uid()::text
    ) OR
    board_id IN (
      SELECT board_id FROM board_collaborators 
      WHERE user_id::text = auth.uid()::text AND permission IN ('edit', 'admin')
    )
  );

CREATE POLICY "Users can delete elements they created or have edit access" ON board_elements
  FOR DELETE USING (
    created_by::text = auth.uid()::text OR
    board_id IN (
      SELECT id FROM boards 
      WHERE owner_id::text = auth.uid()::text
    ) OR
    board_id IN (
      SELECT board_id FROM board_collaborators 
      WHERE user_id::text = auth.uid()::text AND permission IN ('edit', 'admin')
    )
  ); 