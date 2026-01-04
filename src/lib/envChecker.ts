/**
 * Environment variable checker and validator
 * Helps diagnose configuration issues
 */

export interface EnvStatus {
  valid: boolean
  missing: string[]
  invalid: Array<{ key: string; reason: string }>
  present: string[]
  warnings: string[]
}

/**
 * Check all required environment variables
 */
export function checkEnvironmentVariables(): EnvStatus {
  const status: EnvStatus = {
    valid: true,
    missing: [],
    invalid: [],
    present: [],
    warnings: [],
  }

  // Required frontend environment variables
  const requiredVars = {
    VITE_SOCKET_URL: {
      required: false,
      validate: (value: string) => {
        if (!value) return null // Optional
        if (!value.startsWith('http://') && !value.startsWith('https://')) {
          return 'Invalid URL format (should start with http:// or https://)'
        }
        return null
      },
    },
  }

  // Check each variable
  for (const [key, config] of Object.entries(requiredVars)) {
    const value = import.meta.env[key]

    if (!value) {
      if (config.required) {
        status.missing.push(key)
        status.valid = false
      }
    } else {
      status.present.push(key)
      const validationError = config.validate(value)
      if (validationError) {
        status.invalid.push({ key, reason: validationError })
        if (config.required) {
          status.valid = false
        } else {
          status.warnings.push(`${key}: ${validationError}`)
        }
      }
    }
  }

  return status
}

/**
 * Log environment variable status
 */
export function logEnvStatus(status: EnvStatus): void {
  // Logging removed
}

/**
 * Get a user-friendly error message for environment issues
 */
export function getEnvErrorMessage(status: EnvStatus): string | null {
  if (status.valid) return null

  const issues: string[] = []

  if (status.missing.length > 0) {
    issues.push(`Missing: ${status.missing.join(', ')}`)
  }

  if (status.invalid.length > 0) {
    const invalidList = status.invalid.map(({ key, reason }) => `${key} (${reason})`).join(', ')
    issues.push(`Invalid: ${invalidList}`)
  }

  return issues.length > 0 ? issues.join('. ') : null
}
