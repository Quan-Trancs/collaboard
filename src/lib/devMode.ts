export const IS_DEV_APP = import.meta.env.MODE === "development";

export const DEV_LOGIN = {
  email: "slide@example.com",
  password: "devpass123",
  name: "Slide User",
} as const;
