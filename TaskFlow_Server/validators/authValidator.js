const { z } = require("zod");

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  accountType: z.enum(["admin", "agent"]).optional(),
});

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPass: z.string().optional(),
  fullNumber: z.string().trim().optional(),
  // Only a request; the controller decides the actual role (admin only for first-time setup)
  role: z.enum(["admin", "agent"]).optional(),
});

module.exports = {
  loginSchema,
  signupSchema,
};
