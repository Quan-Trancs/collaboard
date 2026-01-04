# Collaboard - Collaborative Whiteboard Application

A real-time collaborative whiteboard application built with React, TypeScript, and Socket.IO.

## Features

### Real-time Collaboration
- **Live Updates** - Real-time synchronization using WebSocket (Socket.IO)
- **Live Cursor Tracking** - See where other collaborators are working
- **Collaborative Editing** - Multiple users can edit simultaneously
- **Instant Sync** - Changes appear instantly across all connected clients

### Drawing & Editing Tools
- **Pen Tool** - Freehand drawing with customizable colors and stroke widths
- **Shapes** - Rectangle and circle tools with various styles
- **Text Tool** - Add and edit text elements
- **Images** - Upload and insert images
- **Tables** - Insert customizable tables
- **Charts** - Create various chart types
- **Icons** - Add icons from Lucide icon library
- **Eraser** - Remove parts of drawings
- **Select Tool** - Move and manipulate elements

### Collaboration Features
- **Team Sharing** - Share boards with team members
- **Permissions Management** - Control access and editing permissions
- **User Presence** - See who's currently viewing/editing
- **Conflict Resolution** - Smart handling of simultaneous edits

### User Experience
- **Auto-save** - Automatic saving of your work
- **Undo/Redo** - Full history support for collaborative editing
- **Responsive Design** - Works seamlessly on desktop and mobile devices
- **Fast Loading** - Code splitting and lazy loading for optimal performance
- **Error Handling** - Robust error handling with retry mechanisms
- **Image Processing** - Optimized image uploads and processing
- **Secure Authentication** - JWT-based authentication with password hashing

## Tech Stack

### Frontend
- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** (shadcn/ui) - Accessible component primitives
- **Socket.IO Client** - Real-time bidirectional communication
- **React Router v6** - Declarative routing
- **React Hook Form** - Performant form management
- **Zod** - Schema validation
- **Framer Motion** - Animation library
- **Lucide React** - Icon library
- **Class Variance Authority** - Component variant management

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web application framework
- **TypeScript** - Type-safe backend development
- **Socket.IO** - Real-time WebSocket communication
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT (jsonwebtoken)** - Token-based authentication
- **bcryptjs** - Password hashing
- **Joi** - Schema validation
- **Helmet** - Security middleware
- **Express Rate Limit** - Rate limiting protection
- **CORS** - Cross-origin resource sharing
- **Morgan** - HTTP request logger
- **Compression** - Response compression middleware

### File Handling
- **Multer** - File upload handling
- **Sharp** - High-performance image processing

### Development Tools
- **ESLint** - Code linting
- **Vitest** - Unit testing framework
- **tsx** - TypeScript execution for Node.js
- **Nodemon** - Development server auto-reload

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- MongoDB (local or MongoDB Atlas account)
- Backend server running (for WebSocket features)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd collaboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   cd backend
   cp env.example .env
   ```
   
   Edit `backend/.env` and add your MongoDB connection:
   ```env
   MONGODB_URI=mongodb://localhost:27017/collaboard
   JWT_SECRET=your-secret-key-change-in-production
   PORT=3001
   CORS_ORIGIN=http://localhost:5173
   ```
   
   Edit `.env` (frontend) and add:
   ```env
   VITE_API_URL=http://localhost:3001/api
   VITE_SOCKET_URL=http://localhost:3001
   ```

4. **Set up MongoDB**
   - See [MongoDB Setup Guide](./docs/MONGODB_SETUP.md) for detailed instructions
   - Use MongoDB Atlas (cloud) or install locally

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Start the backend server** (in a separate terminal)
   ```bash
   cd backend
   npm install
   npm run dev
   ```

## Project Structure

```
collaboard/
├── src/
│   ├── components/          # React components
│   │   ├── auth/           # Authentication components
│   │   ├── dashboard/     # Dashboard components
│   │   ├── whiteboard/     # Whiteboard components
│   │   └── ui/            # Reusable UI components
│   ├── contexts/          # React contexts (Auth, etc.)
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility libraries
│   │   ├── api.ts        # API functions
│   │   ├── apiClient.ts  # Enhanced API client with retry and caching
│   │   └── validation.ts  # Validation schemas
│   └── types/            # TypeScript type definitions
├── backend/              # Backend server
│   └── src/
│       └── index.ts      # Express + Socket.IO server
└── docs/                 # Documentation files
```

## Documentation

- [MongoDB Setup Guide](./docs/MONGODB_SETUP.md) - Database setup instructions
- [WebSocket Implementation](./docs/WEBSOCKET_IMPLEMENTATION.md) - Real-time collaboration details

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details
