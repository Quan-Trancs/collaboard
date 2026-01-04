# Collaboard - Collaborative Whiteboard Application

A real-time collaborative whiteboard application built with React, TypeScript, and Socket.IO.

## Features

- 🎨 **Real-time Collaboration** - Draw, write, and collaborate in real-time with WebSocket support
- 🔐 **Authentication** - User authentication (implement your own)
- 📊 **Multiple Tools** - Pen, shapes, text, images, tables, charts, and more
- 👥 **Team Collaboration** - Share boards with team members and manage permissions
- 💾 **Auto-save** - Automatic saving of your work
- 🎯 **Undo/Redo** - Full history support for collaborative editing
- 📱 **Responsive Design** - Works on desktop and mobile devices

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Radix UI** (shadcn/ui) for accessible components
- **Socket.IO Client** for real-time collaboration
- **React Router** for navigation

### Backend
- **Node.js** with Express
- **Socket.IO** for WebSocket connections
- **MongoDB** with Mongoose for database
- **JWT** for authentication
- **TypeScript** for type safety

### Database
- **MongoDB** - Flexible NoSQL database
- **Mongoose** - MongoDB object modeling

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
