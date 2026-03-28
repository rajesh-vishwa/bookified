"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImageIcon, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth, useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { DEFAULT_VOICE, voiceCategories, voiceOptions } from "@/lib/constants";
import { cn, parsePDFFile } from "@/lib/utils";
import { UploadSchema } from "@/lib/zod";
import type { BookUploadFormValues } from "@/types";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import {
  checkBookExists,
  checkConnection,
  createBook,
  saveBookSegments,
} from "@/lib/actions/book.actions";

import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";

const LoadingOverlay = () => {
  return (
    <div className="loading-wrapper">
      <div className="loading-shadow-wrapper bg-white/95 shadow-soft-md">
        <div className="loading-shadow">
          <div className="loading-animation size-10 rounded-full border-4 border-[#d9c6aa] border-t-[#663820]" />
          <h3 className="loading-title">Synthesizing your book...</h3>
          <div className="loading-progress">
            <div className="loading-progress-item">
              <span className="loading-progress-status" />
              <span>Preparing your literary assistant</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

type FileDropzoneProps = {
  accept: string;
  file?: File;
  disabled?: boolean;
  icon: "pdf" | "image";
  text: string;
  hint: string;
  onFileSelect: (file?: File) => void;
};

const FileDropzone = ({
  accept,
  file,
  disabled,
  icon,
  text,
  hint,
  onFileSelect,
}: FileDropzoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (nextFile?: File) => {
    onFileSelect(nextFile);
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={cn(
        "upload-dropzone border-2 border-dashed border-[#c9b79a] file-upload-shadow",
        file && "upload-dropzone-uploaded",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(event) => handleSelect(event.target.files?.[0])}
      />

      {file ? (
        <div className="flex w-full items-center justify-between gap-3 rounded-lg bg-white/70 px-4 py-3">
          <p className="upload-dropzone-text truncate">{file.name}</p>
          <button
            type="button"
            className="upload-dropzone-remove"
            aria-label="Remove selected file"
            onClick={(e) => {
              e.stopPropagation();
              if (inputRef.current) {
                inputRef.current.value = "";
              }
              handleSelect(undefined);
            }}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <>
          {icon === "pdf" ? (
            <Upload className="upload-dropzone-icon" />
          ) : (
            <ImageIcon className="upload-dropzone-icon" />
          )}
          <p className="upload-dropzone-text">{text}</p>
          <p className="upload-dropzone-hint">{hint}</p>
        </>
      )}
    </div>
  );
};

const UploadForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { userId } = useAuth();
  const router = useRouter();

  const form = useForm<BookUploadFormValues>({
    resolver: zodResolver(UploadSchema),
    defaultValues: {
      coverImage: undefined,
      title: "",
      author: "",
      persona: DEFAULT_VOICE,
      pdfFile: undefined,
    },
  });

  const onSubmit = async (data: BookUploadFormValues) => {
    if (!userId) {
      return toast.error("Please login to upload books");
    }

    setIsSubmitting(true);

    // PostHog -> Track Book Uploads...

    try {
      const existsCheck = await checkBookExists(data.title);

      if (existsCheck.exists && existsCheck.book) {
        toast.info("Book with same title already exists.");
        form.reset();
        router.push(`/books/${existsCheck.book.slug}`);
        return;
      }

      const fileTitle = data.title.replace(/\s+/g, "-").toLowerCase();
      const pdfFile = data.pdfFile;

      const parsedPDF = await parsePDFFile(pdfFile);

      if (parsedPDF.content.length === 0) {
        toast.error(
          "Failed to parse PDF. Please try again with a different file.",
        );
        return;
      }

      const uploadedPdfBlob = await upload(fileTitle, pdfFile, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: "application/pdf",
      });

      let coverUrl: string;

      if (data.coverImage) {
        const coverFile = data.coverImage;
        const uploadedCoverBlob = await upload(
          `${fileTitle}_cover.png`,
          coverFile,
          {
            access: "public",
            handleUploadUrl: "/api/upload",
            contentType: coverFile.type,
          },
        );
        coverUrl = uploadedCoverBlob.url;
      } else {
        const response = await fetch(parsedPDF.cover);
        const blob = await response.blob();

        const uploadedCoverBlob = await upload(`${fileTitle}_cover.png`, blob, {
          access: "public",
          handleUploadUrl: "/api/upload",
          contentType: "image/png",
        });
        coverUrl = uploadedCoverBlob.url;
      }

      const book = await createBook({
        clerkId: userId,
        title: data.title,
        author: data.author,
        persona: data.persona,
        fileURL: uploadedPdfBlob.url,
        fileBlobKey: uploadedPdfBlob.pathname,
        coverURL: coverUrl,
        fileSize: pdfFile.size,
      });

      if (!book.success) {
        toast.error((book.error as string) || "Failed to create book");
        if (book.isBillingError) {
          router.push("/subscriptions");
        }
        return;
      }

      if (book.alreadyExists) {
        toast.info("Book with same title already exists.");
        form.reset();
        router.push(`/books/${book.data.slug}`);
        return;
      }

      const segments = await saveBookSegments(
        book.data._id,
        userId,
        parsedPDF.content,
      );

      if (!segments.success) {
        toast.error("Failed to save book segments");
        throw new Error("Failed to save book segments");
      }

      form.reset();
      router.push("/");
    } catch (error) {
      console.error(error);

      toast.error("Failed to upload book. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {isSubmitting && <LoadingOverlay />}

      <div className="new-book-wrapper">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="pdfFile"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <FileDropzone
                      accept="application/pdf"
                      file={field.value}
                      disabled={isSubmitting}
                      icon="pdf"
                      text="Click to upload PDF"
                      hint="PDF file (max 50MB)"
                      onFileSelect={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="coverImage"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <FileDropzone
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      file={field.value}
                      disabled={isSubmitting}
                      icon="image"
                      text="Click to upload cover image"
                      hint="Leave empty to auto-generate from PDF"
                      onFileSelect={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="form-label">Title</FormLabel>
                  <FormControl>
                    <input
                      {...field}
                      type="text"
                      className="form-input"
                      placeholder="ex: Rich Dad Poor Dad"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="author"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="form-label">Author Name</FormLabel>
                  <FormControl>
                    <input
                      {...field}
                      type="text"
                      className="form-input"
                      placeholder="ex: Robert Kiyosaki"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="persona"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="form-label">
                    Choose Assistant Voice
                  </FormLabel>
                  <FormDescription>
                    Choose a voice that fits your preferred reading companion.
                  </FormDescription>
                  <FormControl>
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-[#5e4e3a]">
                          Male Voices
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {voiceCategories.male.map((voiceKey) => {
                            const voice =
                              voiceOptions[
                                voiceKey as keyof typeof voiceOptions
                              ];
                            const isSelected = field.value === voiceKey;

                            return (
                              <button
                                key={voice.id}
                                type="button"
                                onClick={() => field.onChange(voiceKey)}
                                disabled={isSubmitting}
                                className={cn(
                                  "voice-selector-option text-left",
                                  isSelected
                                    ? "voice-selector-option-selected"
                                    : "voice-selector-option-default",
                                )}
                              >
                                <div className="flex flex-col gap-1">
                                  <span className="font-semibold text-[#2d2418]">
                                    {voice.name}
                                  </span>
                                  <span className="text-xs text-[#6a5a43]">
                                    {voice.description}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-[#5e4e3a]">
                          Female Voices
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {voiceCategories.female.map((voiceKey) => {
                            const voice =
                              voiceOptions[
                                voiceKey as keyof typeof voiceOptions
                              ];
                            const isSelected = field.value === voiceKey;

                            return (
                              <button
                                key={voice.id}
                                type="button"
                                onClick={() => field.onChange(voiceKey)}
                                disabled={isSubmitting}
                                className={cn(
                                  "voice-selector-option text-left",
                                  isSelected
                                    ? "voice-selector-option-selected"
                                    : "voice-selector-option-default",
                                )}
                              >
                                <div className="flex flex-col gap-1">
                                  <span className="font-semibold text-[#2d2418]">
                                    {voice.name}
                                  </span>
                                  <span className="text-xs text-[#6a5a43]">
                                    {voice.description}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="form-btn bg-[#663820] text-white font-serif disabled:opacity-70"
            >
              Begin Synthesis
            </button>
          </form>
        </Form>
      </div>
    </>
  );
};

export default UploadForm;
