# Authentication Flow Documentation

This document describes the complete authentication cycle for the Collaboard application.

## Overview

The application uses **JWT (JSON Web Tokens)** for authentication. Users register/login to receive a token, which is then sent with every authenticated API request.

---

## 1. User Registration Flow

```
┌─────────┐
│  User   │
└────┬────┘
     │
     │ 1. Fills signup form (email, password, name)
     ▼
┌─────────────────┐
│  Frontend       │
│  (AuthForm)     │
└────┬────────────┘
     │
     │ 2. POST /auth/register
     │    Body: { email, password, name }
     ▼
┌─────────────────┐
│  Backend        │
│  /auth/register │
└────┬────────────┘
     │
     │ 3. Validates input
     │ 4. Checks if user exists
     │ 5. Hashes password (bcrypt, 12 rounds)
     │ 6. Creates user in MongoDB
     │ 7. Generates JWT token
     │    - Payload: { userId: user._id }
     │    - Signed with: JWT_SECRET
     │    - Expires in: 7 days (configurable)
     │
     ▼
┌─────────────────┐
│  Response       │
│  { user, token }│
└────┬────────────┘
     │
     │ 8. Returns user data + token
     ▼
┌─────────────────┐
│  Frontend       │
│  (AuthContext)  │
└────┬────────────┘
     │
     │ 9. Saves token to localStorage
     │    localStorage.setItem('auth_token', token)
     │ 10. Updates user state
     │
     ▼
┌─────────┐
│  User   │
│ Logged  │
│   In    │
└─────────┘
```

### Steps:
1. User enters email, password, and name in signup form
2. Frontend sends POST request to `/auth/register`
3. Backend validates the input data
4. Backend checks if user with that email already exists
5. Backend hashes the password using bcrypt (12 rounds)
6. Backend creates new user document in MongoDB
7. Backend generates JWT token:
   - Payload contains `userId` (MongoDB ObjectId as string)
   - Token is signed with `JWT_SECRET` from environment variables
   - Token expires in 7 days (configurable via `JWT_EXPIRES_IN`)
8. Backend returns user data and token
9. Frontend saves token to `localStorage` with key `auth_token`
10. Frontend updates authentication state

---

## 2. User Login Flow

```
┌─────────┐
│  User   │
└────┬────┘
     │
     │ 1. Enters email and password
     ▼
┌─────────────────┐
│  Frontend       │
│  (AuthForm)     │
└────┬────────────┘
     │
     │ 2. POST /auth/login
     │    Body: { email, password }
     ▼
┌─────────────────┐
│  Backend        │
│  /auth/login    │
└────┬────────────┘
     │
     │ 3. Validates input
     │ 4. Finds user by email in MongoDB
     │ 5. Compares password (bcrypt.compare)
     │ 6. If valid:
     │    - Generates JWT token
     │    - Returns user data + token
     │ 7. If invalid:
     │    - Returns 401 "Invalid credentials"
     │
     ▼
┌─────────────────┐
│  Response       │
│  { user, token }│
│  OR 401 Error   │
└────┬────────────┘
     │
     │ 8. If successful: Save token
     ▼
┌─────────────────┐
│  Frontend       │
│  (AuthContext)  │
└────┬────────────┘
     │
     │ 9. Saves token to localStorage
     │ 10. Updates user state
     │
     ▼
┌─────────┐
│  User   │
│ Logged  │
│   In    │
└─────────┘
```

### Steps:
1. User enters email and password in login form
2. Frontend sends POST request to `/auth/login`
3. Backend validates the input data
4. Backend searches for user by email in MongoDB
5. Backend compares provided password with stored hash using `bcrypt.compare()`
6. If password matches:
   - Generate JWT token (same process as registration)
   - Return user data and token
7. If password doesn't match or user doesn't exist:
   - Return 401 status with "Invalid credentials" message
8. Frontend receives response
9. If successful, save token to `localStorage`
10. Frontend updates authentication state

---

## 3. Authenticated API Request Flow

```
┌─────────┐
│  User   │
│ Action  │
│ (e.g.,  │
│ create  │
│ board)  │
└────┬────┘
     │
     │ 1. User performs action
     ▼
┌─────────────────┐
│  Frontend       │
│  (API Client)    │
└────┬────────────┘
     │
     │ 2. Gets token from localStorage
     │    token = localStorage.getItem('auth_token')
     │
     │ 3. Makes API request
     │    POST /api/boards
     │    Headers: {
     │      'Authorization': 'Bearer jwt_token',
     │      'Content-Type': 'application/json'
     │    }
     ▼
┌─────────────────┐
│  Backend        │
│  Middleware     │
│  (authenticate) │
└────┬────────────┘
     │
     │ 4. Extracts token from Authorization header
     │    token = req.headers.authorization.substring(7)
     │
     │ 5. Verifies token:
     │    a. Token exists? → 401 if not
     │    b. Token format valid? → 401 if not
     │    c. Token signature valid? (JWT_SECRET match) → 401 if not
     │    d. Token expired? → 401 if expired
     │    e. User exists in DB? → 401 if not
     │
     │ 6. If valid:
     │    - Decodes token to get userId
     │    - Finds user in MongoDB
     │    - Attaches to request: req.userId, req.user
     │
     ▼
┌─────────────────┐
│  Backend        │
│  Route Handler  │
│  (e.g., /boards)│
└────┬────────────┘
     │
     │ 7. Uses req.userId for user-specific operations
     │    - Creates board with owner_id = req.userId
     │    - Returns data
     │
     ▼
┌─────────────────┐
│  Response       │
│  { board: {...} }│
└────┬────────────┘
     │
     │ 8. Returns data
     ▼
┌─────────────────┐
│  Frontend       │
│  (Component)    │
└────┬────────────┘
     │
     │ 9. Receives and displays data
     ▼
┌─────────┐
│  User   │
│  Sees   │
│ Result│
└─────────┘
```

### Steps:
1. User performs an action requiring authentication (e.g., create board)
2. Frontend API client retrieves token from `localStorage`
3. Frontend makes API request with token in `Authorization` header:
   - Format: `Bearer <token>`
4. Backend authentication middleware intercepts request
5. Middleware verifies token:
   - Checks if `Authorization` header exists and starts with "Bearer "
   - Extracts token (removes "Bearer " prefix)
   - Verifies token signature using `JWT_SECRET`
   - Checks if token is expired
   - Decodes token to get `userId`
   - Verifies user exists in MongoDB
6. If all checks pass:
   - Attaches `userId` and `user` object to request
   - Calls `next()` to proceed to route handler
7. Route handler uses `req.userId` for authenticated operations
8. Backend returns response data
9. Frontend receives and processes the response

---

## 4. Token Validation Process

Every authenticated API request goes through this validation:

```
Token Received
     │
     ├─→ Token exists? ──NO──→ 401 "No token provided"
     │
     └─→ YES
          │
          ├─→ Format valid? (Bearer <token>) ──NO──→ 401 "No token provided"
          │
          └─→ YES
               │
               ├─→ Extract token (remove "Bearer " prefix)
               │
               ├─→ JWT format? (3 parts) ──NO──→ 401 "Invalid token"
               │
               └─→ YES
                    │
                    ├─→ DECODE token (read header + payload)
                    │    - Base64 decode header.payload
                    │    - Extract: userId, expiration (exp), issued at (iat)
                    │
                    ├─→ VERIFY signature
                    │    - Re-sign header.payload with JWT_SECRET
                    │    - Compare new signature with token signature
                    │    - If match: Signature valid
                    │    - If no match: 401 "Invalid signature"
                    │
                    ├─→ Signature valid? ──NO──→ 401 "Invalid signature"
                    │
                    └─→ YES
                         │
                         ├─→ Token expired? (current time > exp) ──YES──→ 401 "Token expired"
                         │
                         └─→ NO
                              │
                              ├─→ User exists? (find by userId from decoded payload) ──NO──→ 401 "User not found"
                              │
                              └─→ YES
                                   │
                                   └─→ Request proceeds
```

### How JWT Token Verification Works:

JWT tokens are **NOT compared directly**. Instead, they go through a **decode and verify** process:

#### Step 1: Token Structure
A JWT token has 3 parts separated by dots:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTUyYmRmYzUyYWNlNTI1ZjNmODFiNjEiLCJpYXQiOjE3NjcxMzgzMDksImV4cCI6MTc2Nzc0MzEwOX0.1Tc0vwikgJKT__Hi7BNZoMeyvnENBCC2vQhhCNDpIGk
│───────────────│ │──────────────────────────────────────────────────────────────────────│ │──────────────────────────────────────────│
     Header                    Payload (encoded)                                                      Signature
```

#### Step 2: Decode (Read the Token)
The backend uses `jwt.verify()` which:
1. **Splits the token** into 3 parts: `[header, payload, signature]`
2. **Base64 decodes** the header and payload to read the data:
   ```json
   // Header (decoded)
   {
     "alg": "HS256",
     "typ": "JWT"
   }
   
   // Payload (decoded)
   {
     "userId": "6952bdfc52ace525f3f81b61",
     "iat": 1767138309,  // Issued at (timestamp)
     "exp": 1767743109   // Expires at (timestamp)
   }
   ```
3. **Extracts information**:
   - `userId` - The user ID from the token
   - `exp` - Expiration timestamp
   - `iat` - Issued at timestamp

#### Step 3: Verify (Check the Signature)
The backend verifies the signature by:
1. **Re-creating the signature**:
   - Takes the header + payload (from the token)
   - Signs it again with the current `JWT_SECRET`
   - Creates a new signature
2. **Compares signatures**:
   - If the new signature matches the token's signature → Valid
   - If they don't match → Invalid (wrong secret or tampered token)
3. **Why this works**:
   - If the token was signed with a different `JWT_SECRET`, the signatures won't match
   - If someone tampered with the payload, the signature won't match
   - Only tokens signed with the correct `JWT_SECRET` will have matching signatures

#### Step 4: Additional Checks
After signature verification:
1. **Expiration Check**: Compares current time with `exp` from decoded payload
2. **User Exists**: Uses `userId` from decoded payload to find user in MongoDB

### Example Code Flow:

```javascript
// Backend middleware (simplified)
const token = req.headers.authorization.substring(7); // Remove "Bearer "
const jwtSecret = process.env.JWT_SECRET;

// jwt.verify() does ALL of this:
// 1. Decodes the token (reads header + payload)
// 2. Verifies signature (re-signs and compares)
// 3. Checks expiration
// 4. Returns decoded payload if valid
const decoded = jwt.verify(token, jwtSecret);
// decoded = { userId: "...", iat: 1234567890, exp: 1234567890 }

// Now we can use the userId from the decoded payload
const user = await User.findById(decoded.userId);
```

### Validation Checks Summary:
1. **Token Exists**: Checks if `Authorization` header is present
2. **Format Valid**: Checks if header starts with "Bearer "
3. **JWT Format**: Token should have 3 parts separated by dots
4. **Decode**: Base64 decodes header and payload to read data
5. **Verify Signature**: Re-signs with `JWT_SECRET` and compares signatures
6. **Check Expiration**: Compares current time with `exp` from decoded payload
7. **User Exists**: Uses `userId` from decoded payload to verify user in MongoDB

---

## 5. Logout Flow

```
┌─────────┐
│  User   │
│ Clicks  │
│ Logout  │
└────┬────┘
     │
     │ 1. User clicks logout button
     ▼
┌─────────────────┐
│  Frontend       │
│  (AuthContext)  │
└────┬────────────┘
     │
     │ 2. Removes token from localStorage
     │    localStorage.removeItem('auth_token')
     │
     │ 3. Clears user state
     │    setUser(null)
     │    setProfile(null)
     │
     │ 4. Redirects to login page
     │
     ▼
┌─────────┐
│  User   │
│ Logged  │
│  Out    │
└─────────┘
```

### Steps:
1. User clicks logout button
2. Frontend removes token from `localStorage`
3. Frontend clears user state (sets user to `null`)
4. Frontend redirects user to login/auth page
5. User is now logged out and must log in again to access protected routes

---

## 6. Get Current User Flow

```
┌─────────┐
│  App    │
│  Loads  │
└────┬────┘
     │
     │ 1. App initializes
     ▼
┌─────────────────┐
│  Frontend       │
│  (AuthContext)  │
└────┬────────────┘
     │
     │ 2. Checks localStorage for token
     │    token = localStorage.getItem('auth_token')
     │
     │ 3. If token exists:
     │    GET /auth/me
     │    Headers: { Authorization: 'Bearer token' }
     ▼
┌─────────────────┐
│  Backend        │
│  /auth/me       │
└────┬────────────┘
     │
     │ 4. Middleware verifies token
     │ 5. Returns current user data
     │
     ▼
┌─────────────────┐
│  Response       │
│  { user: {...} }│
└────┬────────────┘
     │
     │ 6. Updates user state
     ▼
┌─────────────────┐
│  Frontend       │
│  (App)          │
└────┬────────────┘
     │
     │ 7. User is authenticated
     │    Protected routes are accessible
     ▼
```

### Steps:
1. Application loads/initializes
2. Frontend checks `localStorage` for existing token
3. If token exists, makes GET request to `/auth/me` with token
4. Backend middleware verifies token (same process as authenticated requests)
5. Backend returns current user data
6. Frontend updates user state with received data
7. User is considered authenticated and can access protected routes

---

## 7. Token Expiration Flow

```
Token Expires
     │
     │ 1. Token expiration time reached
     ▼
┌─────────────────┐
│  User Makes     │
│  API Request    │
└────┬────────────┘
     │
     │ 2. Request sent with expired token
     ▼
┌─────────────────┐
│  Backend        │
│  Middleware     │
└────┬────────────┘
     │
     │ 3. Token verification fails
     │    Error: "TokenExpiredError"
     │
     ▼
┌─────────────────┐
│  Response       │
│  401 Unauthorized│
│  "Invalid or    │
│   expired token" │
└────┬────────────┘
     │
     │ 4. Frontend receives 401
     ▼
┌─────────────────┐
│  Frontend       │
│  (Error Handler)│
└────┬────────────┘
     │
     │ 5. Removes expired token
     │    localStorage.removeItem('auth_token')
     │
     │ 6. Clears user state
     │
     │ 7. Redirects to login page
     │
     ▼
┌─────────┐
│  User   │
│ Must    │
│ Re-login│
└─────────┘
```

### Steps:
1. Token expiration time is reached (default: 7 days after creation)
2. User makes an API request with expired token
3. Backend middleware verifies token and detects expiration
4. Backend returns 401 Unauthorized with "Invalid or expired token" message
5. Frontend error handler receives 401 response
6. Frontend removes expired token from `localStorage`
7. Frontend clears user state and redirects to login page
8. User must log in again to get a new token

---

## Key Components

### Backend Components:
- **Auth Routes** (`/auth/register`, `/auth/login`, `/auth/me`, `/auth/profile`)
- **Auth Middleware** (`authenticate`) - Verifies tokens on protected routes
- **User Model** - MongoDB schema for user data
- **Password Hashing** - bcrypt with 12 rounds
- **JWT Generation** - Creates tokens signed with `JWT_SECRET`
- **JWT Verification** - Validates token signature and expiration

### Frontend Components:
- **AuthContext** - Manages authentication state and user data
- **AuthForm** - Login/signup UI component
- **API Client** - Automatically adds token to request headers
- **Protected Routes** - Redirects unauthenticated users to login
- **Token Storage** - `localStorage` with key `auth_token`

---

## Environment Variables

### Backend (.env):
```env
JWT_SECRET=your-secret-key-here  # Used to sign and verify tokens
JWT_EXPIRES_IN=7d                # Token expiration time
MONGODB_URI=mongodb://...        # Database connection
```

### Frontend (.env):
```env
VITE_API_URL=http://localhost:3001/api  # Backend API URL
```

---

## Security Considerations

1. **Password Security**:
   - Passwords are hashed with bcrypt (12 rounds) before storage
   - Plain passwords are never stored in database

2. **Token Security**:
   - Tokens are signed with a secret key (`JWT_SECRET`)
   - Tokens expire after a set time (default: 7 days)
   - Tokens are stored in `localStorage` (consider httpOnly cookies for production)

3. **Token Validation**:
   - Every authenticated request verifies token signature
   - Expired tokens are rejected
   - Invalid tokens are rejected

4. **Error Handling**:
   - Generic error messages prevent user enumeration
   - Invalid credentials return same error as non-existent user

---

## Common Issues and Solutions

### Issue: "Invalid signature" error
**Cause**: Token was created with different `JWT_SECRET` than current one
**Solution**: Clear token and log in again to get new token with current secret

### Issue: "Token expired" error
**Cause**: Token has passed its expiration time
**Solution**: User must log in again to get a new token

### Issue: "No token provided" error
**Cause**: Token not sent in request or not in localStorage
**Solution**: Check if token exists in localStorage, log in if missing

### Issue: "User not found" error
**Cause**: User was deleted from database but token still references them
**Solution**: Clear token and log in again (or recreate user account)

