import { describe, expect, it } from "vitest";
import { buildXlsxFile } from "@/sidepanel/lib/xlsx";

async function blobText(blob: Blob): Promise<string> {
  return new TextDecoder().decode(await blob.arrayBuffer());
}

describe("buildXlsxFile", () => {
  it("builds a real xlsx zip with workbook and worksheet xml", async () => {
    const blob = buildXlsxFile({
      sheets: [
        {
          name: "商品",
          columns: [
            { key: "title", header: "标题" },
            { key: "price", header: "价格" },
            { key: "inStock", header: "有货" }
          ],
          rows: [
            { title: "A & B", price: 1299, inStock: true },
            { title: "C", price: null, inStock: false }
          ]
        }
      ]
    });

    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("[Content_Types].xml");
    expect(text).toContain("xl/workbook.xml");
    expect(text).toContain("xl/worksheets/sheet1.xml");
    expect(text).toContain("A &amp; B");
    expect(text).toContain('<c r="B2"><v>1299</v></c>');
    expect(text).toContain('<c r="C2" t="b"><v>1</v></c>');
  });

  it("derives headers from object rows when columns are omitted", async () => {
    const blob = buildXlsxFile({
      sheets: [
        {
          name: "Data",
          rows: [
            { title: "A", url: "https://a" },
            { title: "B", price: "$2" }
          ]
        }
      ]
    });

    const text = await blobText(blob);
    expect(text).toContain('<c r="A1" t="inlineStr"><is><t>title</t></is></c>');
    expect(text).toContain('<c r="B1" t="inlineStr"><is><t>url</t></is></c>');
    expect(text).toContain('<c r="C1" t="inlineStr"><is><t>price</t></is></c>');
  });
});
