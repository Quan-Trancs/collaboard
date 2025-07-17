import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/ui/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { ErrorHandler, handleAsyncError } from "@/lib/errorHandler";
import { loginSchema, signupSchema } from "@/lib/validation";
import { validateAndToast } from "@/lib/validationUtils";
import type { LoginFormData, SignupFormData } from "@/lib/validation";
import { RetryButton } from "@/components/ui/retry-button";

interface AuthFormProps {
  onAuthSuccess?: (user: { id: string; email: string; name: string }) => void;
}

const AuthForm = ({ onAuthSuccess }: AuthFormProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);

  const form = useForm<LoginFormData & { name?: string }>({
    defaultValues: {
      email: "",
      password: "",
      name: "",
    },
  });

  const onSubmit = async (data: LoginFormData & { name?: string }) => {
    setIsLoading(true);
    setLoginError(null);
    setSignupError(null);
    
    try {
      if (isLogin) {
        // Validate login data
        const validatedData = validateAndToast(loginSchema, data, "Login");
        if (!validatedData) {
          setIsLoading(false);
          return;
        }

        const { error } = await handleAsyncError(
          () => signIn(validatedData.email, validatedData.password),
          "AuthForm.signIn"
        );
        if (error) {
          toast(ErrorHandler.getToastConfig(error));
          setLoginError(error.message);
        } else {
          toast({
            title: "Welcome back!",
            description: `Successfully logged in as ${validatedData.email}`,
          });
        }
      } else {
        // Validate signup data
        const signupData = { ...data, name: data.name || data.email.split("@")[0] };
        const validatedData = validateAndToast(signupSchema, signupData, "Signup");
        if (!validatedData) {
          setIsLoading(false);
          return;
        }

        const { error } = await handleAsyncError(
          () => signUp(validatedData.email, validatedData.password, validatedData.name),
          "AuthForm.signUp"
        );
        if (error) {
          toast(ErrorHandler.getToastConfig(error));
          setSignupError(error.message);
        } else {
          toast({
            title: "Account created!",
            description: "Please check your email to verify your account.",
          });
        }
      }
    } catch (error) {
      const appError = ErrorHandler.createError(error, "Authentication");
      ErrorHandler.logError(appError, "Authentication");
      toast(ErrorHandler.getToastConfig(appError));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md bg-white">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isLogin ? "Sign in to your account" : "Create your account"}
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin
              ? "Enter your email and password to access your whiteboards"
              : "Enter your details to create a new account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" aria-busy={isLoading}>
              {!isLogin && (
                <FormField
                  control={form.control}
                  name="name"
                  rules={{ required: "Name is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="auth-name">Full Name</FormLabel>
                      <FormControl>
                        <Input id="auth-name" placeholder="John Doe" autoComplete="name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="email"
                rules={{
                  required: "Email is required",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Invalid email address",
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="auth-email">Email</FormLabel>
                    <FormControl>
                      <Input
                        id="auth-email"
                        type="email"
                        placeholder="john@example.com"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                rules={{
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters",
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="auth-password">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          id="auth-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete={isLogin ? "current-password" : "new-password"}
                          {...field}
                        />
                        <button
                          type="button"
                          tabIndex={0}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                          onClick={() => setShowPassword((v) => !v)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full flex items-center justify-center" disabled={isLoading}
                tabIndex={0}
                aria-busy={isLoading}
              >
                {isLoading && (
                  <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>
                )}
                {isLoading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
              </Button>
            </form>
          </Form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              tabIndex={0}
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
          {/* Toast area for screen readers */}
          <div aria-live="polite" className="sr-only"></div>
          {/* Error overlays for async actions */}
          {loginError && (
            <div className="fixed top-4 right-4 z-50">
              <RetryButton
                error={loginError}
                onRetry={() => onSubmit(form.getValues())}
                isLoading={isLoading}
              />
            </div>
          )}
          {signupError && (
            <div className="fixed top-4 right-4 z-50">
              <RetryButton
                error={signupError}
                onRetry={() => onSubmit(form.getValues())}
                isLoading={isLoading}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthForm;
