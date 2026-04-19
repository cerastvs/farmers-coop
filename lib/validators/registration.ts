import { z } from "zod";

export const ApplicationSchema = z.object({
  fullName: z.string().min(3, "Full name must be at least 3 characters"),

  age: z.coerce
    .number()
    .int("Age must be a whole number")
    .min(18, "You must be at least 18")
    .max(100, "Invalid age"),

  gender: z
    .string()
    .min(1, "Gender is required")
    .refine((val) => ["Male", "Female"].includes(val), {
      message: "Invalid gender",
    }),

  address: z.string().min(5, "Address is too short"),

  contact: z
    .string()
    .min(10, "Contact number is too short")
    .max(15, "Contact number is too long")
    .regex(/^[0-9]+$/, "Contact must be numbers only"),

  farmSize: z.coerce.number().positive("Farm size must be greater than 0"),

  cropType: z.string().min(2, "Crop type is required"),

  yearsFarming: z.coerce
    .number()
    .int("Years must be a whole number")
    .min(0, "Cannot be negative")
    .max(80, "Too high"),

  validId: z
    .any()
    .refine((val) => val instanceof File && val.size > 0, {
      message: "Valid ID is required",
    }),

  proofOfFarm: z
    .any()
    .refine((val) => val instanceof File && val.size > 0, {
      message: "Proof of farming is required",
    }),
});
