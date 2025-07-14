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

interface AuthFormProps {
  onAuthSuccess?: (user: { id: string; email: string; name: string }) => void;
}

interface FormData {
  email: string;
  password: string;
  name?: string;
}

const AuthForm = ({ onAuthSuccess }: AuthFormProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormData>({
    defaultValues: {
      email: "",
      password: "",
      name: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock successful authentication
      const user = {
        id: Math.random().toString(36).substr(2, 9),
        email: data.email,
        name: data.name || data.email.split("@")[0],
      };

      toast({
        title: isLogin ? "Welcome back!" : "Account created!",
        description: `Successfully ${isLogin ? "logged in" : "registered"} as ${user.email}`,
      });

      onAuthSuccess?.(user);
    } catch (error) {
      toast({
        title: "Authentication failed",
        description: "Please check your credentials and try again.",
        variant: "destructive",
      });
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
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthForm;
