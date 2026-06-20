import { generateSealCode, validateSealScan } from "../qr.service";

describe("qr.service", () => {
  it("generates a seal code that validates against itself", () => {
    const sealCode = generateSealCode("booking-1");

    expect(validateSealScan(sealCode, sealCode)).toBe(true);
  });

  it("rejects a scan against a seal code for a different booking", () => {
    const sealA = generateSealCode("booking-a");
    const sealB = generateSealCode("booking-b");

    expect(validateSealScan(sealA, sealB)).toBe(false);
  });

  it("rejects a malformed or tampered scanned code", () => {
    const sealCode = generateSealCode("booking-1");

    expect(validateSealScan("not-a-real-jwt", sealCode)).toBe(false);
    expect(validateSealScan(sealCode, "not-a-real-jwt")).toBe(false);
  });

  it("rejects a scan with a forged signature for the same booking", () => {
    const sealCode = generateSealCode("booking-1");
    const forged = sealCode.slice(0, -1) + (sealCode.endsWith("a") ? "b" : "a");

    expect(validateSealScan(forged, sealCode)).toBe(false);
  });
});
