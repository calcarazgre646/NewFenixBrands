/**
 * Verifica que el mirror Deno (supabase/functions/_shared/salesPulse/*)
 * sea byte-equivalente al domain original. Si alguien modifica un archivo
 * y olvida el otro, este test falla con un diff claro.
 *
 * Usa el helper `?raw` de Vite para leer los archivos como string sin
 * depender de tipos Node.
 */
import { describe, expect, it } from "vitest";

// Mirror copies (relative to this test file)
import typesMirror   from "../../../../supabase/functions/_shared/salesPulse/types.ts?raw";
import narrMirror    from "../../../../supabase/functions/_shared/salesPulse/narrative.ts?raw";
import htmlMirror    from "../../../../supabase/functions/_shared/salesPulse/htmlTemplate.ts?raw";

// Source originals
import typesSrc      from "../types.ts?raw";
import narrSrc       from "../narrative.ts?raw";
import htmlSrc       from "../htmlTemplate.ts?raw";

describe("salesPulse domain mirror", () => {
  it("types.ts coincide entre src/domain y supabase/functions/_shared", () => {
    expect(typesMirror).toBe(typesSrc);
  });

  it("narrative.ts coincide entre src/domain y supabase/functions/_shared", () => {
    expect(narrMirror).toBe(narrSrc);
  });

  it("htmlTemplate.ts coincide entre src/domain y supabase/functions/_shared", () => {
    expect(htmlMirror).toBe(htmlSrc);
  });
});
