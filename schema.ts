import { z } from "zod";
export const todoItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  pinned: z.boolean(),
  createdAt: z.date(),
  order: z.number(),
  priority: z.enum(["Low", "Medium", "High"]),
  dtstart: z.date(),
  durationMinutes: z.number(),
  due: z.date(),
  rrule: z.string().nullable(),
  timeZone: z.string(),
  userID: z.string(),
  completed: z.boolean(),
  exdates: z.array(z.date()),
  instances: z.array(z.any()).nullable(),
  instanceDate: z.date().nullable(),
});
export const registrationSchema = z.object({
  fname: z
    .string({ message: "name cannot be left empty" })
    .trim()
    .min(2, { message: "first name is atleast two characters" }),
  lname: z.string().optional(),
  email: z
    .string({ message: "email cannot be left empty" })
    .trim()
    .email({ message: "email is incorrect" }),
  password: z
    .string({ message: "password cannot be empty" })
    .min(8, { message: "password cannot be smaller than 8" })
    .regex(/[A-Z]/, {
      message: "password must have at least one uppercase letter",
    })
    .regex(/[\W_]/, {
      message: "password must have at least one special character",
    }),
});

export const loginSchema = z.object({
  email: z
    .string({ message: "email cannot be left empty" })
    .trim()
    .email({ message: "email is incorrect" }),
  password: z.string(),
});

export const todoSchema = z.object({
  title: z
    .string({ message: "title cannot be left empty" })
    .trim()
    .min(1, { message: "title cannot be left empty" }),
  description: z.string().optional(),
  priority: z.enum(["Low", "Medium", "High"], {
    errorMap: () => ({ message: "priority must be one of: low, medium, high" }),
  }),
  dtstart: z.date({ message: "start date is not identified" }),
  due: z.date({ message: "end date is not identified" }),
  rrule: z.string().nullable(),
  projectID: z.string().nullable().optional(),
});

export const todoInstanceSchema = z.object({
  title: z
    .string({ message: "title cannot be left empty" })
    .trim()
    .min(1, { message: "title cannot be left empty" }),
  description: z.string().optional(),
  priority: z.enum(["Low", "Medium", "High"], {
    errorMap: () => ({ message: "priority must be one of: low, medium, high" }),
  }),
  dtstart: z.date({ message: "start date is not identified" }),
  due: z.date({ message: "end date is not identified" }),
  instanceDate: z.date({ message: "instance date is not identified" }),
  rrule: z.string().nullable(),
});

export const noteSchema = z.object({
  name: z
    .string({ message: "title cannot be left empty" })
    .trim()
    .min(1, { message: "title cannot be left empty" }),
  content: z.string().nullable().optional(),
});
export const ProjectColor = [
  "RED",
  "ORANGE",
  "YELLOW",
  "LIME",
  "BLUE",
  "PURPLE",
  "PINK",
  "TEAL",
  "CORAL",
  "GOLD",
  "DEEP_BLUE",
  "ROSE",
  "LIGHT_RED",
  "BRICK",
  "SLATE",
] as const;
export const projectBaseSchema = z.object({
  id: z.string({ message: "id cannot be left empty" }),
  name: z
    .string({ message: "title cannot be left empty" })
    .trim()
    .min(1, { message: "title cannot be left empty" }),
  color: z.enum(ProjectColor).nullable(),
});

export const projectCreateSchema = projectBaseSchema.pick({
  name: true,
});

export type ProjectColorType = (typeof ProjectColor)[number];

export const projectPatchSchema = projectBaseSchema.partial().extend({
  name: z
    .string({ message: "title cannot be left empty" })
    .trim()
    .min(1, { message: "title cannot be left empty" })
    .optional(),
  color: z.enum(ProjectColor).optional(),
});

// CalDAV schemas
export const calDavAccountSchema = z.object({
  displayName: z
    .string({ message: "display name is required" })
    .trim()
    .min(1, { message: "display name cannot be empty" }),
  serverUrl: z
    .string({ message: "server URL is required" })
    .trim()
    .url({ message: "server URL must be a valid URL" }),
  username: z
    .string({ message: "username is required" })
    .trim()
    .min(1, { message: "username cannot be empty" }),
  password: z
    .string({ message: "password is required" })
    .min(1, { message: "password cannot be empty" }),
});

export const calDavCalendarPatchSchema = z.object({
  syncDirection: z
    .enum(["BIDIRECTIONAL", "PULL_ONLY", "PUSH_ONLY"])
    .optional(),
  componentType: z.enum(["VTODO", "VEVENT"]).optional(),
  projectId: z.string().nullable().optional(),
});

export const calDavSyncConflictResolutionSchema = z.object({
  syncItemId: z.string({ message: "sync item ID is required" }),
  resolution: z.enum(["LOCAL_WINS", "SERVER_WINS"], {
    errorMap: () => ({
      message: "resolution must be LOCAL_WINS or SERVER_WINS",
    }),
  }),
});

export const userPreferencesSchema = z.object({
  sortBy: z
    .enum(["dtstart", "due", "duration", "priority"])
    .nullable()
    .optional(),
  groupBy: z
    .enum(["dtstart", "due", "duration", "priority", "rrule", "project"])
    .nullable()
    .optional(),
  direction: z.enum(["Ascending", "Descending"]).nullable().optional(),
});
