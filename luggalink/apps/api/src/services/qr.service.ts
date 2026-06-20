import { createHmac } from "node:crypto";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import Jimp from "jimp";
import { uploadToS3 } from "../utils/s3";

const SEAL_SECRET = process.env.QR_SEAL_SECRET ?? "";
const QR_IMAGE_SIZE = 400;

export interface SealPayload {
  bookingId: string;
  createdAt: number;
  sig: string;
}

function signSeal(bookingId: string, createdAt: number): string {
  return createHmac("sha256", SEAL_SECRET).update(`${bookingId}${createdAt}`).digest("hex");
}

export function generateSealCode(bookingId: string): string {
  const createdAt = Date.now();
  const sig = signSeal(bookingId, createdAt);
  const payload: SealPayload = { bookingId, createdAt, sig };
  return jwt.sign(payload, SEAL_SECRET);
}

export async function generateQrImageBuffer(sealCode: string): Promise<Buffer> {
  return QRCode.toBuffer(sealCode, {
    type: "png",
    width: QR_IMAGE_SIZE,
    margin: 2,
  });
}

export function validateSealScan(scannedCode: string, expectedCode: string): boolean {
  let scannedPayload: SealPayload;
  let expectedPayload: SealPayload;

  try {
    scannedPayload = jwt.verify(scannedCode, SEAL_SECRET) as SealPayload;
    expectedPayload = jwt.verify(expectedCode, SEAL_SECRET) as SealPayload;
  } catch {
    return false;
  }

  if (scannedPayload.bookingId !== expectedPayload.bookingId) {
    return false;
  }

  const expectedSig = signSeal(scannedPayload.bookingId, scannedPayload.createdAt);
  return scannedPayload.sig === expectedSig;
}

export async function uploadSealToS3(buffer: Buffer, bookingId: string): Promise<string> {
  return uploadToS3({
    key: `qr-seals/${bookingId}.png`,
    body: buffer,
    contentType: "image/png",
  });
}

export async function generateWatermarkedSealImage(sealCode: string, bookingId: string): Promise<Buffer> {
  const qrBuffer = await generateQrImageBuffer(sealCode);
  const qrImage = await Jimp.read(qrBuffer);

  const canvasHeight = QR_IMAGE_SIZE + 80;
  const canvas = new Jimp(QR_IMAGE_SIZE, canvasHeight, "#ffffff");
  canvas.composite(qrImage, 0, 0);

  const font = await Jimp.loadFont(Jimp.FONT_SANS_14_BLACK);
  canvas.print(font, 0, QR_IMAGE_SIZE + 8, {
    text: `Booking: ${bookingId}`,
    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
  }, QR_IMAGE_SIZE, 24);
  canvas.print(font, 0, QR_IMAGE_SIZE + 36, {
    text: "LuggaLink — Tamper Evident",
    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
  }, QR_IMAGE_SIZE, 24);

  return canvas.getBufferAsync(Jimp.MIME_PNG);
}
