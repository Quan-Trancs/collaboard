# MongoDB Setup Guide

This project uses **MongoDB** with **Mongoose** as the database solution.

## Why MongoDB?

- Flexible schemas (perfect for whiteboard elements with varying structures)
- Easy to set up and use
- Works great with Node.js/Express
- Free tier available (MongoDB Atlas)
- Good for nested/embedded data structures

## Setup Options

### Option 1: MongoDB Atlas (Cloud - Recommended)

1. **Create a MongoDB Atlas account**
   - Go to https://www.mongodb.com/cloud/atlas
   - Sign up for a free account

2. **Create a cluster**
   - Choose the free tier (M0)
   - Select a cloud provider and region
   - Wait for cluster creation (~5 minutes)

3. **Configure database access**
   - Go to "Database Access" → "Add New Database User"
   - **Authentication Method**: Choose "Password"
   - **Username**: Enter a username (e.g., `admin` or `collaboard-user`)
   - **Password**: Enter a strong password (save this securely!)
   - **Database User Privileges**: 
     - Select "Built-in Role"
     - Choose **"Atlas admin"** (for development) OR **"Read and write to any database"** (more restrictive)
   - **DO NOT** enable "Restrict Access to Specific Clusters" (leave it disabled)
   - **DO NOT** enable "Temporary User" (unless you want it to expire)
   - Click "Add User"

4. **Configure network access**
   - Go to "Network Access" → "Add IP Address"
   - Click "Allow Access from Anywhere" (for development)
   - Or add your specific IP address

5. **Get connection string**
   - Go to "Database" → "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - **Important**: If your password contains special characters, URL-encode them:
     - `<` becomes `%3C`
     - `>` becomes `%3E`
     - `@` becomes `%40`
     - `:` becomes `%3A`
     - `/` becomes `%2F`
     - `?` becomes `%3F`
     - `#` becomes `%23`
     - `[` becomes `%5B`
     - `]` becomes `%5D`
   - Add the database name at the end: `/collaboard`
   - Example: `mongodb+srv://username:password@cluster.mongodb.net/collaboard`

6. **Add to `.env` file**
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/collaboard
   ```

### Option 2: Local MongoDB

1. **Install MongoDB**
   - Windows: Download from https://www.mongodb.com/try/download/community
   - macOS: `brew install mongodb-community`
   - Linux: Follow instructions at https://docs.mongodb.com/manual/installation/

2. **Start MongoDB**
   - Windows: MongoDB should start as a service automatically
   - macOS/Linux: `mongod --dbpath ~/data/db`

3. **Add to `.env` file**
   ```env
   MONGODB_URI=mongodb://localhost:27017/collaboard
   ```

## Environment Variables

Add to `backend/.env`:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/collaboard
# OR for Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/collaboard

# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

## Database Schema

The application uses the following collections:

- **users** - User accounts and profiles
- **boards** - Whiteboard boards
- **boardelements** - Drawing elements on boards
- **boardcollaborators** - Board sharing and permissions

## Testing the Connection

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. You should see:
   ```
   [SUCCESS] MongoDB connected successfully
      Database: collaboard
   ```

## Troubleshooting

### Connection Error
- Check your `MONGODB_URI` is correct
- For Atlas: Ensure your IP is whitelisted
- For local: Ensure MongoDB is running (`mongod`)

### Authentication Error
- Verify your database username and password
- **If password contains special characters**: URL-encode them in the connection string
- Check user has proper permissions (should be "Atlas admin" or "Read and write to any database")

### Network Error
- Check firewall settings
- Verify MongoDB port (27017) is accessible

## Next Steps

1. Set up MongoDB (choose Atlas or local)
2. Configure `.env` file
3. Start the backend server
4. Test registration/login endpoints

