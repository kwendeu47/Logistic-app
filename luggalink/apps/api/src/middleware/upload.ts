import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { fromBuffer as fileTypeFromBuffer } from "file-type";
import multer from "multer";
import { BadRequestError } from "../utils/errors";
import { scanBufferForMalware } from "../utils/malwareScan";
import { uploadToS3 } from "../utils/s3";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 10;

const memoryStorage = multer.memoryStorage();

export const uploadSingleImage = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(new BadRequestError("Only JPEG, PNG, or WEBP images are allowed"));
      return;
    }
    callback(null, true);
  },
});

export const uploadMultipleImages = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES_PER_REQUEST },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(new BadRequestError("Only JPEG, PNG, or WEBP images are allowed"));
      return;
    }
    callback(null, true);
  },
});

async function verifyFileIsAllowedImage(file: Express.Multer.File): Promise<void> {
  const detected = await fileTypeFromBuffer(file.buffer);

  if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
    throw new BadRequestError(
      `File "${file.originalname}" does not match an allowed image type (its declared type can be spoofed)`,
    );
  }

  await scanBufferForMalware(file.buffer, file.originalname);
}

export function verifyUploadedFiles() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const files: Express.Multer.File[] = req.file ? [req.file] : Array.isArray(req.files) ? req.files : [];

    if (files.length > MAX_FILES_PER_REQUEST) {
      throw new BadRequestError(`A maximum of ${MAX_FILES_PER_REQUEST} files may be uploaded per request`);
    }

    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      await verifyFileIsAllowedImage(file);
    }

    next();
  };
}

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

export function attachUploadedImageUrls(folder: string, bodyField: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      next();
      return;
    }

    const urls = await Promise.all(
      files.map((file) =>
        uploadToS3({
          key: `${folder}/${randomUUID()}-${file.originalname}`,
          body: file.buffer,
          contentType: file.mimetype,
        }),
      ),
    );

    req.body[bodyField] = urls;
    next();
  };
}
