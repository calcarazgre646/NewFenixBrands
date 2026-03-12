import { describe, it, expect, vi } from "vitest";
import { fetchAllRows } from "../paginate";

// Helper: create a mock query builder that returns pages of data
function mockQueryBuilder(pages: Array<Array<Record<string, unknown>>>) {
  let callCount = 0;
  return () => ({
    range: vi.fn(async () => {
      const page = pages[callCount] ?? [];
      callCount++;
      return { data: page, error: null };
    }),
  });
}

function mockQueryBuilderError(errorMsg: string) {
  return () => ({
    range: vi.fn(async () => ({
      data: null,
      error: { message: errorMsg },
    })),
  });
}

describe("fetchAllRows", () => {
  it("returns empty array when first page is empty", async () => {
    const builder = mockQueryBuilder([[]]);
    const result = await fetchAllRows(builder);
    expect(result).toEqual([]);
  });

  it("returns single page when data < PAGE_SIZE (1000)", async () => {
    const data = Array.from({ length: 500 }, (_, i) => ({ id: i }));
    const builder = mockQueryBuilder([data]);
    const result = await fetchAllRows(builder);
    expect(result).toHaveLength(500);
    expect(result[0]).toEqual({ id: 0 });
  });

  it("paginates when first page is exactly PAGE_SIZE", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const page2 = Array.from({ length: 300 }, (_, i) => ({ id: 1000 + i }));
    const builder = mockQueryBuilder([page1, page2]);
    const result = await fetchAllRows(builder);
    expect(result).toHaveLength(1300);
    expect(result[999]).toEqual({ id: 999 });
    expect(result[1000]).toEqual({ id: 1000 });
  });

  it("handles multiple full pages + partial last page", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const page2 = Array.from({ length: 1000 }, (_, i) => ({ id: 1000 + i }));
    const page3 = Array.from({ length: 42 }, (_, i) => ({ id: 2000 + i }));
    const builder = mockQueryBuilder([page1, page2, page3]);
    const result = await fetchAllRows(builder);
    expect(result).toHaveLength(2042);
  });

  it("handles multiple full pages + empty last page", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const page2 = Array.from({ length: 1000 }, (_, i) => ({ id: 1000 + i }));
    const page3: Array<Record<string, unknown>> = [];
    const builder = mockQueryBuilder([page1, page2, page3]);
    const result = await fetchAllRows(builder);
    expect(result).toHaveLength(2000);
  });

  it("throws on error from Supabase", async () => {
    const builder = mockQueryBuilderError("connection timeout");
    await expect(fetchAllRows(builder)).rejects.toThrow("fetchAllRows page 0: connection timeout");
  });

  it("calls buildQuery fresh for each page", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const page2 = Array.from({ length: 100 }, (_, i) => ({ id: 1000 + i }));
    let buildCallCount = 0;
    const builder = () => {
      buildCallCount++;
      const pageIdx = buildCallCount - 1;
      return {
        range: vi.fn(async () => ({
          data: pageIdx === 0 ? page1 : page2,
          error: null,
        })),
      };
    };
    await fetchAllRows(builder);
    expect(buildCallCount).toBe(2);
  });

  it("passes correct range parameters", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const page2 = Array.from({ length: 100 }, (_, i) => ({ id: 1000 + i }));
    const rangeCalls: Array<[number, number]> = [];
    let pageIdx = 0;
    const builder = () => ({
      range: vi.fn(async (from: number, to: number) => {
        rangeCalls.push([from, to]);
        const data = pageIdx === 0 ? page1 : page2;
        pageIdx++;
        return { data, error: null };
      }),
    });
    await fetchAllRows(builder);
    expect(rangeCalls[0]).toEqual([0, 999]);
    expect(rangeCalls[1]).toEqual([1000, 1999]);
  });

  it("handles null data as empty (stops pagination)", async () => {
    const builder = () => ({
      range: vi.fn(async () => ({ data: null, error: null })),
    });
    const result = await fetchAllRows(builder);
    expect(result).toEqual([]);
  });
});
