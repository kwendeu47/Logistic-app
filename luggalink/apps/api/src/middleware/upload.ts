import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { BadRequestError } from "../utils/errors";
import { uploadToS3 } from "../utils/s3";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const uploadSingleImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(new BadRequestError("Only JPEG, PNG, or WEBP images are allowed"));
      return;
    }
    callback(null, true);
  },
});

export function attachUploadedImageUrl(folder: string, bodyField: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) {
      next();
      return;
    }

    const key = `${folder}/${randomUUID()}-${req.file.originalname}`;
    const url = await uploadToS3({
      key,
      body: req.file.buffer,
      contentType: req.file.mimetype,
    });

    req.body[bodyField] = url;
    next();
  };
}
