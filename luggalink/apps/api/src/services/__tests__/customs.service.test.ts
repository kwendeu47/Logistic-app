import { uploadToS3 } from "../../utils/s3";
import { generateCustomsForm, generateAndUploadCustomsForm } from "../customs.service";

jest.mock("../../utils/s3", () => ({
  uploadToS3: jest.fn(),
}));

describe("customs.service", () => {
  const booking = { id: "booking-1" };
  const item = {
    name: "Laptop",
    description: "A laptop computer",
    weightLbs: 5.5,
    declaredValueUsd: 999.99,
    category: "ELECTRONICS",
    recipientName: "John Recipient",
    recipientAddress: "123 Main St",
    recipientCountry: "Canada",
  };
  const sender = {
    firstName: "Jane",
    lastName: "Sender",
    postalAddress: "456 Sender Ave",
    country: "USA",
  };
  const traveler = {
    firstName: "Tom",
    lastName: "Traveler",
    postalAddress: null,
    country: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateCustomsForm", () => {
    it("generates a non-empty PDF buffer", async () => {
      const buffer = await generateCustomsForm(booking, item, sender, traveler);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("handles items with documents category and missing sender address fields", async () => {
      const docItem = { ...item, category: "DOCUMENTS", description: "" };
      const minimalSender = { firstName: "Jane", lastName: "Sender" };

      const buffer = await generateCustomsForm(booking, docItem, minimalSender, traveler);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("handles an unrecognized category by falling back to 'other'", async () => {
      const otherItem = { ...item, category: "JEWELRY" };

      const buffer = await generateCustomsForm(booking, otherItem, sender, traveler);

      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
  });

  describe("generateAndUploadCustomsForm", () => {
    it("uploads the generated PDF to S3 and returns its URL", async () => {
      (uploadToS3 as jest.Mock).mockResolvedValue("https://bucket.s3.amazonaws.com/customs-forms/booking-1.pdf");

      const url = await generateAndUploadCustomsForm(booking, item, sender, traveler);

      expect(uploadToS3).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "customs-forms/booking-1.pdf",
          contentType: "application/pdf",
          body: expect.anything(),
        }),
      );
      expect(url).toBe("https://bucket.s3.amazonaws.com/customs-forms/booking-1.pdf");
    });
  });
});
