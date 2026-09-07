# Collaboard - Collaborative Whiteboard Application

A real-time collaborative whiteboard application built with React, TypeScript, and Socket.IO.

> **History:** Evolved from the Vue/Nuxt [WhiteBoard](https://github.com/Quan-Trancs/WhiteBoard) experiment (archived predecessor). Deployable API also lives in [CollaboardBackend](https://github.com/Quan-Trancs/CollaboardBackend); this repo includes a `backend/` folder for local full-stack work.

## Features

### Real-time Collaboration
- **Live Updates** - Socket.IO stream; Redis holds the in-flight board, Mongo persists on commit
- **Live Cursor Tracking** - Throttled ~20 Hz presence with client-side interpolation
- **Collaborative Editing** - Preview while dragging or drawing; commit on mouseup, insert, paste, or delete
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
- **Last-write-wins on commit** - In-progress previews are not undo history; last committed patch wins

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
- **MongoDB** - Durable store for users, boards, objects, and ink
- **Redis** - Live board hashes and Socket.IO adapter
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
- Docker Desktop (MongoDB + Redis)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd collaboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd backend && npm install && cd ..
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   cp backend/env.example backend/.env
   ```

4. **Start development mode** (Mongo, Redis, API, and Vite)

   ```bash
   npm run dev
   ```

   Open http://localhost:5173

   Demo account (seeded automatically in development):

   - Email: `slide@example.com`
   - Password: `devpass123`

   API health: http://localhost:3001/health

   Run pieces separately if you need to:

   ```bash
   npm run db:up
   npm run dev:api
   npm run dev:web
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

- [Architecture topology](./docs/ARCHITECTURE.md) - Stream vs REST, Redis, Mongo, presence/commit
- [MongoDB Setup Guide](./docs/MONGODB_SETUP.md) - Database setup instructions
- [WebSocket Implementation](./docs/WEBSOCKET_IMPLEMENTATION.md) - Events, persistence, and client presence

## Available Scripts

- `npm run dev` - Development mode: Docker Mongo/Redis, API, and Vite
- `npm run dev:web` - Frontend only
- `npm run dev:api` - Backend only
- `npm run db:up` / `npm run db:down` - Start/stop Mongo and Redis
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm test` - Run frontend tests

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details
