import { z } from "zod";

const sanitizeSql = (val: string) => {
  return val
    .replace(/;/g, "")
    .replace(/--/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'/g, "''");
};

export const ApplicationSchema = z.object({
  firstName: z.string().min(1, "First name is required").transform(sanitizeSql),
  middleName: z.string().optional().transform((val) => (val ? sanitizeSql(val) : "")),
  lastName: z.string().min(1, "Last name is required").transform(sanitizeSql),
  extensionName: z.string().optional().transform((val) => (val ? sanitizeSql(val) : "")),

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
    })
    .transform(sanitizeSql),

  address: z.string().min(5, "Address is too short").transform(sanitizeSql),

  contact: z
    .string()
    .min(10, "Contact number is too short")
    .max(15, "Contact number is too long")
    .regex(/^[0-9]+$/, "Contact must be numbers only")
    .transform(sanitizeSql),

  farmSize: z.coerce.number().positive("Farm size must be greater than 0"),

  cropType: z.string().min(2, "Crop type is required").transform(sanitizeSql),

  yearsFarming: z.coerce
    .number()
    .int("Years must be a whole number")
    .min(0, "Cannot be negative")
    .max(80, "Too high"),

  farmOwnership: z
    .enum(["FARM_OWNER", "FARM_WORKER", "OTHERS"])
    .default("FARM_OWNER"),

  farmMachinery: z.string().optional().transform((val) => (val ? sanitizeSql(val.trim()) : "")),

  guarantor: z
    .object({
      firstName: z.string().min(1, "Guarantor first name is required").transform(sanitizeSql),
      middleName: z.string().optional().transform((val) => (val ? sanitizeSql(val) : "")),
      lastName: z.string().min(1, "Guarantor last name is required").transform(sanitizeSql),
      extensionName: z.string().optional().transform((val) => (val ? sanitizeSql(val) : "")),
      contact: z
        .string()
        .min(10, "Guarantor contact is too short")
        .max(15, "Guarantor contact is too long")
        .regex(/^[0-9]+$/, "Guarantor contact must be numbers only")
        .transform(sanitizeSql),
      relationship: z.string().min(1, "Relationship is required").transform(sanitizeSql),
    })
    .partial()
    .optional(),

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
