# Authentication Error Codes Reference

This document lists all authentication error codes used in the application.

## Error Codes

### Token Errors

| Code | HTTP Status | Message | Description |
|------|-------------|---------|-------------|
| `NO_TOKEN` | 401 | "No token provided" | Authorization header is missing |
| `INVALID_TOKEN_FORMAT` | 400 | "Invalid token format. Expected 'Bearer <token>'" | Authorization header doesn't start with "Bearer " |
| `INVALID_TOKEN_SIGNATURE` | 401 | "Invalid token signature" | Token signature doesn't match JWT_SECRET |
| `TOKEN_EXPIRED` | 401 | "Token has expired" | Token expiration time has passed |
| `TOKEN_NOT_ACTIVE` | 400 | "Token not active yet" | Token is not yet valid (notBefore check) |
| `INVALID_TOKEN` | 401 | "Invalid token" | Generic invalid token error |
| `AUTH_ERROR` | 500 | "Authentication error" | Unexpected authentication error |

### User Errors

| Code | HTTP Status | Message | Description |
|------|-------------|---------|-------------|
| `USER_NOT_FOUND` | 404 | "User not found" | User doesn't exist in database |
| `INVALID_CREDENTIALS` | 401 | "Invalid credentials" | Wrong email or password |
| `USER_EXISTS` | 409 | "User already exists" | Email already registered |

### Validation Errors

| Code | HTTP Status | Message | Description |
|------|-------------|---------|-------------|
| `VALIDATION_ERROR` | 400 | "Validation failed" | Input validation failed (from Joi) |

## Error Code Usage

### Backend

Errors are returned in this format:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Frontend

Errors are handled by `ErrorHandler` which:
1. Maps error codes to user-friendly messages
2. Provides appropriate toast notifications
3. Handles automatic token cleanup for auth errors

## Error Flow

```
Backend Error
    ↓
Returns { error, code }
    ↓
Frontend ApiError
    ↓
ErrorHandler.createError()
    ↓
AppError with type and code
    ↓
ErrorHandler.getToastConfig()
    ↓
User-friendly toast notification
```

## Example Usage

### Backend
```typescript
res.status(401).json({ 
  error: 'Token has expired', 
  code: 'TOKEN_EXPIRED' 
});
```

### Frontend
```typescript
// Error is automatically handled
// User sees: "Session Expired - Your session has expired. Please log in again."
```

