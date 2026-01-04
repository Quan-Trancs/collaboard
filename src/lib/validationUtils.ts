import { z } from "zod";
import { toast } from "@/components/ui/use-toast";

export interface ValidationError {
  field: string;
  message: string;
}

export function formatZodError(error: z.ZodError): ValidationError[] {
  return error.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));
}

export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: ValidationError[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: formatZodError(result.error) };
  }
}

export function validateAndToast<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string = "Validation"
): T | null {
  const result = validateSchema(schema, data);
  
  if (result.success) {
    return result.data;
  } else {
    // Show first error in toast
    const firstError = result.errors[0];
    toast({
      title: `${context} Error`,
      description: firstError.message,
      variant: "destructive",
    });
    
    // Log all errors in development
    // Validation errors (removed console logging for production)
    
    return null;
  }
}

export function getFieldError(errors: ValidationError[], field: string): string | undefined {
  return errors.find((error) => error.field === field)?.message;
}

// Helper for React Hook Form integration
export function zodResolver<T>(schema: z.ZodSchema<T>) {
  return (data: unknown) => {
    const result = validateSchema(schema, data);
    
    if (result.success) {
      return { values: result.data, errors: {} };
    } else {
      const errors: Record<string, { type: string; message: string }> = {};
      result.errors.forEach((error) => {
        errors[error.field] = {
          type: "validation",
          message: error.message,
        };
      });
      return { values: {}, errors };
    }
  };
} 