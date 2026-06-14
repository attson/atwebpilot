import { describe, expect, it } from "vitest";
import { fileToImagePart, MAX_IMAGE_BYTES } from "@/sidepanel/lib/image-utils";

function blob(type: string, sizeBytes: number): Blob {
  const arr = new Uint8Array(sizeBytes);
  for (let i = 0; i < sizeBytes; i++) arr[i] = i % 256;
  return new Blob([arr], { type });
}

describe("fileToImagePart", () => {
  it("converts a small PNG to a base64 ImagePart", async () => {
    const b = blob("image/png", 16);
    const part = await fileToImagePart(b);
    expect(part.type).toBe("image");
    expect(part.media_type).toBe("image/png");
    expect(typeof part.data).toBe("string");
    expect(part.data.length).toBeGreaterThan(0);
  });

  it("rejects oversized files", async () => {
    const b = blob("image/png", MAX_IMAGE_BYTES + 1);
    await expect(fileToImagePart(b)).rejects.toThrow(/超过/);
  });

  it("rejects non-image types", async () => {
    const b = blob("text/plain", 16);
    await expect(fileToImagePart(b)).rejects.toThrow(/不支持/);
  });

  it("accepts jpeg / gif / webp", async () => {
    for (const t of ["image/jpeg", "image/gif", "image/webp"] as const) {
      const part = await fileToImagePart(blob(t, 8));
      expect(part.media_type).toBe(t);
    }
  });
});
