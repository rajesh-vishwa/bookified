import { ACCEPTED_IMAGE_TYPES, ACCEPTED_PDF_TYPES, MAX_FILE_SIZE, MAX_IMAGE_SIZE } from "@/lib/constants";
import { z } from "zod";

const hasBrowserFile = typeof File !== "undefined";

const fileSchema = z
  .custom<File>((value) => (hasBrowserFile ? value instanceof File : true), {
    message: "A file is required.",
  });

const optionalFileSchema = z.custom<File | undefined>(
  (value) => (value === undefined ? true : hasBrowserFile ? value instanceof File : true),
  {
    message: "Invalid file.",
  },
);

export const UploadSchema = z.object({
  pdfFile: fileSchema
    .refine((file) => file.size <= MAX_FILE_SIZE, "PDF file must be 50MB or less.")
    .refine(
      (file) => ACCEPTED_PDF_TYPES.includes(file.type),
      "Please upload a valid PDF file.",
    ),
  coverImage: optionalFileSchema
    .refine(
      (file) => !file || file.size <= MAX_IMAGE_SIZE,
      "Cover image must be 10MB or less.",
    )
    .refine(
      (file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type),
      "Cover image must be JPG, PNG, or WEBP.",
    )
    .optional(),
  title: z.string().trim().min(2, "Title is required."),
  author: z.string().trim().min(2, "Author name is required."),
  voice: z.enum(["dave", "daniel", "chris", "rachel", "sarah"], {
    error: "Please choose an assistant voice.",
  }),
});

