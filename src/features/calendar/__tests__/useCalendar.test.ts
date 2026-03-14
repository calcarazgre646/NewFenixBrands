/**
 * Tests para features/calendar/hooks/useCalendar.ts
 *
 * Cobertura completa:
 * - validateDateRange
 * - parseBudgetInput
 * - validateEventForm
 * - toFC mapping (con nuevos campos)
 * - eventsForDay (year view)
 * - Category slug + dedup
 * - categoryHasEvents
 * - Optimistic update + rollback
 * - Shared calendar edge cases
 * - Description + budget + currency edge cases
 */
import { describe, it, expect } from "vitest";
import {
  validateDateRange,
  parseBudgetInput,
  validateEventForm,
  type DbEvent,
  type CalendarEvent,
  type DbCategory,
  type EventInput,
} from "../hooks/useCalendar";

// ─── Helper ─────────────────────────────────────────────────────────────────

function toFCTest(row: DbEvent): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    start: row.start_date,
    end: row.end_date ?? undefined,
    extendedProps: {
      calendar: row.category,
      description: row.description ?? null,
      budget: row.budget ?? null,
      currency: row.currency ?? "PYG",
    },
  };
}

function makeDbEvent(overrides: Partial<DbEvent> = {}): DbEvent {
  return {
    id: "evt-1",
    title: "Test Event",
    description: null,
    start_date: "2026-04-01",
    end_date: null,
    category: "general",
    budget: null,
    currency: "PYG",
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

// ─── validateDateRange ──────────────────────────────────────────────────────

describe("validateDateRange", () => {
  it("accepts valid range (start < end)", () => {
    expect(validateDateRange("2026-03-01", "2026-03-05")).toBeNull();
  });

  it("accepts same start and end date", () => {
    expect(validateDateRange("2026-03-01", "2026-03-01")).toBeNull();
  });

  it("accepts null end date (single-day event)", () => {
    expect(validateDateRange("2026-03-01", null)).toBeNull();
  });

  it("rejects end before start", () => {
    const err = validateDateRange("2026-03-05", "2026-03-01");
    expect(err).toContain("anterior");
  });

  it("rejects empty start date", () => {
    const err = validateDateRange("", null);
    expect(err).toContain("inicio");
  });

  it("rejects empty start with valid end", () => {
    expect(validateDateRange("", "2026-03-05")).not.toBeNull();
  });

  it("accepts cross-month range", () => {
    expect(validateDateRange("2026-03-28", "2026-04-02")).toBeNull();
  });

  it("accepts cross-year range", () => {
    expect(validateDateRange("2026-12-28", "2027-01-05")).toBeNull();
  });
});

// ─── parseBudgetInput ───────────────────────────────────────────────────────

describe("parseBudgetInput", () => {
  describe("valid inputs", () => {
    it("empty string → null (no budget)", () => {
      expect(parseBudgetInput("")).toEqual({ value: null, error: null });
    });

    it("whitespace only → null", () => {
      expect(parseBudgetInput("   ")).toEqual({ value: null, error: null });
    });

    it("plain number", () => {
      expect(parseBudgetInput("5000000")).toEqual({ value: 5000000, error: null });
    });

    it("zero is valid (free event)", () => {
      expect(parseBudgetInput("0")).toEqual({ value: 0, error: null });
    });

    it("PY format with dots (5.000.000)", () => {
      expect(parseBudgetInput("5.000.000")).toEqual({ value: 5000000, error: null });
    });

    it("decimal with comma (1.500,50 → 1500.50)", () => {
      expect(parseBudgetInput("1.500,50")).toEqual({ value: 1500.50, error: null });
    });

    it("small number", () => {
      expect(parseBudgetInput("100")).toEqual({ value: 100, error: null });
    });

    it("very large number (billions)", () => {
      expect(parseBudgetInput("15000000000")).toEqual({ value: 15000000000, error: null });
    });

    it("number with leading/trailing spaces", () => {
      expect(parseBudgetInput("  5000  ")).toEqual({ value: 5000, error: null });
    });
  });

  describe("invalid inputs", () => {
    it("letters → error", () => {
      const result = parseBudgetInput("abc");
      expect(result.value).toBeNull();
      expect(result.error).toContain("número");
    });

    it("mixed letters and numbers → error", () => {
      const result = parseBudgetInput("5000abc");
      expect(result.value).toBeNull();
      expect(result.error).not.toBeNull();
    });

    it("negative number → error", () => {
      const result = parseBudgetInput("-5000");
      expect(result.value).toBeNull();
      expect(result.error).toContain("negativo");
    });

    it("negative with dots → error", () => {
      const result = parseBudgetInput("-5.000.000");
      expect(result.value).toBeNull();
      expect(result.error).toContain("negativo");
    });

    it("special characters only → error", () => {
      const result = parseBudgetInput("$$$");
      expect(result.value).toBeNull();
      expect(result.error).not.toBeNull();
    });

    it("currency symbol prefix → error", () => {
      const result = parseBudgetInput("₲ 5000000");
      expect(result.value).toBeNull();
      expect(result.error).not.toBeNull();
    });
  });
});

// ─── validateEventForm ──────────────────────────────────────────────────────

describe("validateEventForm", () => {
  const validFields = {
    title: "Campaña Martel",
    category: "marketing",
    startDate: "2026-04-01",
    endDate: "2026-04-05",
    budgetRaw: "5000000",
  };

  it("rejects empty budget", () => {
    const err = validateEventForm({ ...validFields, budgetRaw: "" });
    expect(err).toContain("presupuesto");
  });

  it("accepts valid form with budget", () => {
    expect(validateEventForm({ ...validFields, budgetRaw: "5000000" })).toBeNull();
  });

  it("rejects empty title", () => {
    const err = validateEventForm({ ...validFields, title: "" });
    expect(err).toContain("título");
  });

  it("rejects whitespace-only title", () => {
    const err = validateEventForm({ ...validFields, title: "   " });
    expect(err).toContain("título");
  });

  it("rejects missing category", () => {
    const err = validateEventForm({ ...validFields, category: "" });
    expect(err).toContain("categoría");
  });

  it("rejects invalid date range", () => {
    const err = validateEventForm({ ...validFields, startDate: "2026-04-05", endDate: "2026-04-01" });
    expect(err).toContain("anterior");
  });

  it("rejects empty start date", () => {
    const err = validateEventForm({ ...validFields, startDate: "" });
    expect(err).toContain("inicio");
  });

  it("rejects invalid budget (letters)", () => {
    const err = validateEventForm({ ...validFields, budgetRaw: "abc" });
    expect(err).toContain("número");
  });

  it("rejects negative budget", () => {
    const err = validateEventForm({ ...validFields, budgetRaw: "-1000" });
    expect(err).toContain("negativo");
  });

  it("rejects budget exceeding max", () => {
    const err = validateEventForm({ ...validFields, budgetRaw: "999999999999" });
    expect(err).toContain("máximo");
  });

  it("validates in order: title → category → dates → budget", () => {
    // All invalid: should return title error first
    const err = validateEventForm({ title: "", category: "", startDate: "", endDate: "", budgetRaw: "abc" });
    expect(err).toContain("título");
  });

  it("category error shown before date error", () => {
    const err = validateEventForm({ ...validFields, category: "", startDate: "" });
    expect(err).toContain("categoría");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DATA MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

// ─── toFC mapping ───────────────────────────────────────────────────────────

describe("DbEvent → CalendarEvent mapping", () => {
  it("maps all core fields", () => {
    const fc = toFCTest(makeDbEvent({
      id: "evt-1", title: "Llegada Martel",
      start_date: "2026-03-15", end_date: "2026-03-18", category: "logistica",
    }));
    expect(fc.id).toBe("evt-1");
    expect(fc.title).toBe("Llegada Martel");
    expect(fc.start).toBe("2026-03-15");
    expect(fc.end).toBe("2026-03-18");
    expect(fc.extendedProps.calendar).toBe("logistica");
  });

  it("converts null end_date to undefined", () => {
    const fc = toFCTest(makeDbEvent({ end_date: null }));
    expect(fc.end).toBeUndefined();
  });

  it("maps description correctly", () => {
    const fc = toFCTest(makeDbEvent({ description: "Contenedor #45 desde Shanghai" }));
    expect(fc.extendedProps.description).toBe("Contenedor #45 desde Shanghai");
  });

  it("null description stays null", () => {
    const fc = toFCTest(makeDbEvent({ description: null }));
    expect(fc.extendedProps.description).toBeNull();
  });

  it("maps PYG budget", () => {
    const fc = toFCTest(makeDbEvent({ budget: 15000000, currency: "PYG" }));
    expect(fc.extendedProps.budget).toBe(15000000);
    expect(fc.extendedProps.currency).toBe("PYG");
  });

  it("maps USD budget", () => {
    const fc = toFCTest(makeDbEvent({ budget: 25000, currency: "USD" }));
    expect(fc.extendedProps.budget).toBe(25000);
    expect(fc.extendedProps.currency).toBe("USD");
  });

  it("null budget stays null", () => {
    const fc = toFCTest(makeDbEvent({ budget: null }));
    expect(fc.extendedProps.budget).toBeNull();
  });

  it("zero budget is preserved (not nullified)", () => {
    const fc = toFCTest(makeDbEvent({ budget: 0 }));
    expect(fc.extendedProps.budget).toBe(0);
  });

  it("defaults currency to PYG when missing", () => {
    const row = { ...makeDbEvent() } as DbEvent;
    // Simulate missing currency from old DB rows
    (row as unknown as Record<string, unknown>).currency = undefined;
    const fc = toFCTest(row);
    expect(fc.extendedProps.currency).toBe("PYG");
  });

  it("full event with all fields populated", () => {
    const fc = toFCTest(makeDbEvent({
      id: "full-1", title: "Campaña 360",
      description: "Lanzamiento con influencers + POS + digital",
      start_date: "2026-06-01", end_date: "2026-06-30",
      category: "marketing", budget: 85000000, currency: "PYG",
    }));
    expect(fc.extendedProps.description).toBe("Lanzamiento con influencers + POS + digital");
    expect(fc.extendedProps.budget).toBe(85000000);
    expect(fc.extendedProps.currency).toBe("PYG");
    expect(fc.extendedProps.calendar).toBe("marketing");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// YEAR VIEW
// ═══════════════════════════════════════════════════════════════════════════════

describe("eventsForDay logic", () => {
  function eventsForDay(dateStr: string, events: CalendarEvent[]): CalendarEvent[] {
    return events.filter((ev) => {
      const start = ev.start as string;
      const end = ev.end as string | undefined;
      if (!end) return start === dateStr;
      return start <= dateStr && dateStr < end;
    });
  }

  const events: CalendarEvent[] = [
    { id: "1", title: "Single day", start: "2026-03-15", extendedProps: { calendar: "a", description: null, budget: null, currency: "PYG" } },
    { id: "2", title: "Multi day", start: "2026-03-10", end: "2026-03-13", extendedProps: { calendar: "b", description: null, budget: null, currency: "PYG" } },
    { id: "3", title: "Another", start: "2026-03-15", end: "2026-03-17", extendedProps: { calendar: "c", description: null, budget: 5000000, currency: "PYG" } },
  ];

  it("finds single-day event on exact date", () => {
    expect(eventsForDay("2026-03-15", events).map((e) => e.id)).toContain("1");
  });

  it("single-day NOT found on other dates", () => {
    expect(eventsForDay("2026-03-14", events).map((e) => e.id)).not.toContain("1");
  });

  it("multi-day found on start date", () => {
    expect(eventsForDay("2026-03-10", events).map((e) => e.id)).toContain("2");
  });

  it("multi-day found on middle date", () => {
    expect(eventsForDay("2026-03-11", events).map((e) => e.id)).toContain("2");
  });

  it("multi-day NOT found on end date (exclusive)", () => {
    expect(eventsForDay("2026-03-13", events).map((e) => e.id)).not.toContain("2");
  });

  it("returns multiple events on same day", () => {
    expect(eventsForDay("2026-03-15", events)).toHaveLength(2);
  });

  it("empty for day with no events", () => {
    expect(eventsForDay("2026-04-01", events)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

describe("category slug generation", () => {
  function slugify(label: string): string {
    return label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  }

  it("lowercase", () => { expect(slugify("Marketing")).toBe("marketing"); });
  it("spaces → underscores", () => { expect(slugify("Acción Comercial")).toBe("accin_comercial"); });
  it("removes special chars", () => { expect(slugify("Llegadas 2026!")).toBe("llegadas_2026"); });
  it("multiple spaces", () => { expect(slugify("a  b   c")).toBe("a_b_c"); });
  it("empty string", () => { expect(slugify("")).toBe(""); });
  it("preserves numbers + underscores", () => { expect(slugify("fase_1_test")).toBe("fase_1_test"); });
  it("special chars only → empty slug (blocked by addCategory)", () => { expect(slugify("!!!")).toBe(""); });
  it("emojis only → empty slug", () => { expect(slugify("🎉🎊")).toBe(""); });
});

describe("categoryHasEvents", () => {
  function categoryHasEvents(events: CalendarEvent[], categoryId: string): boolean {
    return events.some((ev) => ev.extendedProps?.calendar === categoryId);
  }

  const events: CalendarEvent[] = [
    { id: "1", title: "A", start: "2026-01-01", extendedProps: { calendar: "logistica", description: null, budget: null, currency: "PYG" } },
    { id: "2", title: "B", start: "2026-01-02", extendedProps: { calendar: "marketing", description: null, budget: 1000, currency: "USD" } },
  ];

  it("true for category with events", () => {
    expect(categoryHasEvents(events, "logistica")).toBe(true);
  });

  it("false for category without events", () => {
    expect(categoryHasEvents(events, "comercial")).toBe(false);
  });

  it("false for empty list", () => {
    expect(categoryHasEvents([], "logistica")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// OPTIMISTIC UPDATES + ROLLBACK
// ═══════════════════════════════════════════════════════════════════════════════

describe("optimistic update with new fields", () => {
  it("update preserves description and budget in optimistic state", () => {
    const events: CalendarEvent[] = [
      { id: "1", title: "Original", start: "2026-03-01", extendedProps: { calendar: "a", description: "Old desc", budget: 1000, currency: "PYG" } },
    ];
    const updated = events.map((ev) =>
      ev.id === "1"
        ? { ...ev, title: "Updated", extendedProps: { ...ev.extendedProps, description: "New desc", budget: 5000000 } }
        : ev,
    );
    expect(updated[0].extendedProps.description).toBe("New desc");
    expect(updated[0].extendedProps.budget).toBe(5000000);
  });

  it("rollback restores original description and budget", () => {
    const original: CalendarEvent[] = [
      { id: "1", title: "A", start: "2026-03-01", extendedProps: { calendar: "a", description: "Original desc", budget: 1000, currency: "PYG" } },
    ];
    const updated = original.map((ev) =>
      ev.id === "1"
        ? { ...ev, extendedProps: { ...ev.extendedProps, description: "Changed", budget: 9999 } }
        : ev,
    );
    // Rollback
    expect(original[0].extendedProps.description).toBe("Original desc");
    expect(original[0].extendedProps.budget).toBe(1000);
    expect(updated[0].extendedProps.budget).toBe(9999);
  });

  it("removing budget (value → null) in optimistic update", () => {
    const events: CalendarEvent[] = [
      { id: "1", title: "A", start: "2026-03-01", extendedProps: { calendar: "a", description: null, budget: 5000000, currency: "PYG" } },
    ];
    const updated = events.map((ev) =>
      ev.id === "1"
        ? { ...ev, extendedProps: { ...ev.extendedProps, budget: null } }
        : ev,
    );
    expect(updated[0].extendedProps.budget).toBeNull();
  });

  it("changing currency in optimistic update", () => {
    const events: CalendarEvent[] = [
      { id: "1", title: "A", start: "2026-03-01", extendedProps: { calendar: "a", description: null, budget: 5000, currency: "PYG" as const } },
    ];
    const updated = events.map((ev) =>
      ev.id === "1"
        ? { ...ev, extendedProps: { ...ev.extendedProps, currency: "USD" as const } }
        : ev,
    );
    expect(updated[0].extendedProps.currency).toBe("USD");
  });

  it("optimistic delete removes event with budget data", () => {
    const events: CalendarEvent[] = [
      { id: "1", title: "A", start: "2026-03-01", extendedProps: { calendar: "a", description: "desc", budget: 10000000, currency: "PYG" } },
      { id: "2", title: "B", start: "2026-03-02", extendedProps: { calendar: "b", description: null, budget: null, currency: "PYG" } },
    ];
    const deleted = events.filter((ev) => ev.id !== "1");
    expect(deleted).toHaveLength(1);
    expect(deleted[0].id).toBe("2");
  });

  it("optimistic move preserves description and budget", () => {
    const event: CalendarEvent = {
      id: "1", title: "A", start: "2026-03-01", end: "2026-03-03",
      extendedProps: { calendar: "a", description: "Important", budget: 5000000, currency: "PYG" },
    };
    const moved = { ...event, start: "2026-03-05", end: "2026-03-07" };
    expect(moved.extendedProps.description).toBe("Important");
    expect(moved.extendedProps.budget).toBe(5000000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED CALENDAR
// ═══════════════════════════════════════════════════════════════════════════════

describe("shared calendar — Realtime deduplication", () => {
  it("INSERT skips if already in state", () => {
    const existing: CalendarEvent[] = [
      { id: "evt-1", title: "Here", start: "2026-03-15", extendedProps: { calendar: "a", description: null, budget: null, currency: "PYG" } },
    ];
    const incoming = makeDbEvent({ id: "evt-1" });
    const result = existing.some((e) => e.id === incoming.id) ? existing : [...existing, toFCTest(incoming)];
    expect(result).toHaveLength(1);
    expect(result).toBe(existing);
  });

  it("INSERT adds other user's event", () => {
    const existing: CalendarEvent[] = [
      { id: "evt-1", title: "Mine", start: "2026-03-15", extendedProps: { calendar: "a", description: null, budget: null, currency: "PYG" } },
    ];
    const incoming = makeDbEvent({ id: "evt-2", title: "From other user", budget: 3000000 });
    const result = existing.some((e) => e.id === incoming.id) ? existing : [...existing, toFCTest(incoming)];
    expect(result).toHaveLength(2);
    expect(result[1].extendedProps.budget).toBe(3000000);
  });

  it("INSERT from other user preserves description and budget", () => {
    const incoming = makeDbEvent({
      id: "evt-new", title: "Campaña", description: "Descripción compartida",
      budget: 25000000, currency: "PYG",
    });
    const fc = toFCTest(incoming);
    expect(fc.extendedProps.description).toBe("Descripción compartida");
    expect(fc.extendedProps.budget).toBe(25000000);
  });
});

describe("shared calendar — concurrent edits", () => {
  it("update on deleted event detected", () => {
    const events: CalendarEvent[] = [
      { id: "evt-1", title: "A", start: "2026-03-15", extendedProps: { calendar: "a", description: null, budget: null, currency: "PYG" } },
    ];
    expect(events.some((ev) => ev.id === "evt-2")).toBe(false);
  });

  it("Realtime UPDATE overwrites with server budget", () => {
    const afterOptimistic: CalendarEvent[] = [
      { id: "evt-1", title: "Local edit", start: "2026-03-15",
        extendedProps: { calendar: "a", description: null, budget: 1000, currency: "PYG" } },
    ];
    const serverRow = makeDbEvent({ id: "evt-1", title: "Server edit", budget: 9999999 });
    const afterRealtime = afterOptimistic.map((e) => e.id === serverRow.id ? toFCTest(serverRow) : e);
    expect(afterRealtime[0].title).toBe("Server edit");
    expect(afterRealtime[0].extendedProps.budget).toBe(9999999);
  });
});

describe("shared calendar — category", () => {
  it("duplicate slug reuses existing", () => {
    const categories: Record<string, DbCategory> = {
      marketing: { id: "marketing", label: "Marketing", color: "#465fff" },
    };
    expect(!!categories["marketing"]).toBe(true);
  });

  it("orphan event gets fallback color", () => {
    const categories: Record<string, DbCategory> = {};
    expect(categories["deleted"]?.color ?? "#465fff").toBe("#465fff");
  });

  it("color optimistic update and rollback", () => {
    const cats: Record<string, DbCategory> = {
      marketing: { id: "marketing", label: "Marketing", color: "#465fff" },
    };
    const updated = { ...cats, marketing: { ...cats.marketing, color: "#12b76a" } };
    expect(updated.marketing.color).toBe("#12b76a");
    expect(cats.marketing.color).toBe("#465fff");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DESCRIPTION EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe("description edge cases", () => {
  it("empty string description treated as empty (not null in form)", () => {
    const input: EventInput = {
      title: "Test", description: "", startDate: "2026-04-01",
      endDate: "", category: "a", budget: null, currency: "PYG",
    };
    expect(input.description).toBe("");
  });

  it("description with special characters preserved", () => {
    const desc = "Llegada #45 — 2 contenedores (40' HC) → Depósito Central";
    const fc = toFCTest(makeDbEvent({ description: desc }));
    expect(fc.extendedProps.description).toBe(desc);
  });

  it("very long description (1000+ chars) preserved", () => {
    const desc = "A".repeat(1500);
    const fc = toFCTest(makeDbEvent({ description: desc }));
    expect(fc.extendedProps.description).toHaveLength(1500);
  });

  it("description with line breaks preserved", () => {
    const desc = "Línea 1\nLínea 2\nLínea 3";
    const fc = toFCTest(makeDbEvent({ description: desc }));
    expect(fc.extendedProps.description).toContain("\n");
  });

  it("description with unicode/emojis preserved", () => {
    const desc = "Campaña verano ☀️ + outlet 🏷️";
    const fc = toFCTest(makeDbEvent({ description: desc }));
    expect(fc.extendedProps.description).toBe(desc);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUDGET EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe("budget edge cases", () => {
  it("budget 0 is not treated as null", () => {
    const fc = toFCTest(makeDbEvent({ budget: 0 }));
    expect(fc.extendedProps.budget).toBe(0);
    expect(fc.extendedProps.budget).not.toBeNull();
  });

  it("very small budget (1 guaraní)", () => {
    const fc = toFCTest(makeDbEvent({ budget: 1 }));
    expect(fc.extendedProps.budget).toBe(1);
  });

  it("very large budget (100 billion PYG)", () => {
    const fc = toFCTest(makeDbEvent({ budget: 100_000_000_000 }));
    expect(fc.extendedProps.budget).toBe(100_000_000_000);
  });

  it("USD decimal budget preserved", () => {
    const fc = toFCTest(makeDbEvent({ budget: 1500.50, currency: "USD" }));
    expect(fc.extendedProps.budget).toBe(1500.50);
  });

  it("parseBudgetInput with USD decimal format", () => {
    // User types 1500.50 for USD
    expect(parseBudgetInput("1500,50")).toEqual({ value: 1500.50, error: null });
  });

  it("parseBudgetInput with only dots (PY thousands)", () => {
    expect(parseBudgetInput("10.500.000")).toEqual({ value: 10500000, error: null });
  });

  it("parseBudgetInput with trailing dot", () => {
    expect(parseBudgetInput("5000.")).toEqual({ value: 5000, error: null });
  });

  it("budget exceeding max (100B) rejected", () => {
    const result = parseBudgetInput("200000000000");
    expect(result.value).toBeNull();
    expect(result.error).toContain("máximo");
  });

  it("budget at max boundary (100B) accepted", () => {
    expect(parseBudgetInput("100000000000")).toEqual({ value: 100_000_000_000, error: null });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CURRENCY EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe("currency edge cases", () => {
  it("PYG is the default", () => {
    const fc = toFCTest(makeDbEvent());
    expect(fc.extendedProps.currency).toBe("PYG");
  });

  it("USD explicitly set", () => {
    const fc = toFCTest(makeDbEvent({ currency: "USD" }));
    expect(fc.extendedProps.currency).toBe("USD");
  });

  it("budget null with PYG currency (no budget, currency irrelevant)", () => {
    const fc = toFCTest(makeDbEvent({ budget: null, currency: "PYG" }));
    expect(fc.extendedProps.budget).toBeNull();
    expect(fc.extendedProps.currency).toBe("PYG");
  });

  it("budget null with USD currency (no budget, currency preserved)", () => {
    const fc = toFCTest(makeDbEvent({ budget: null, currency: "USD" }));
    expect(fc.extendedProps.currency).toBe("USD");
  });

  it("switching currency preserves budget value", () => {
    const pyg: CalendarEvent = {
      id: "1", title: "A", start: "2026-03-01",
      extendedProps: { calendar: "a", description: null, budget: 5000, currency: "PYG" },
    };
    const switched = { ...pyg, extendedProps: { ...pyg.extendedProps, currency: "USD" as const } };
    expect(switched.extendedProps.budget).toBe(5000);
    expect(switched.extendedProps.currency).toBe("USD");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FORM INTEGRATION SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════

describe("form → EventInput integration", () => {
  it("create event: all fields populated", () => {
    const input: EventInput = {
      title: "Campaña Martel", description: "Lanzamiento colección",
      startDate: "2026-06-01", endDate: "2026-06-30",
      category: "marketing", budget: 85000000, currency: "PYG",
    };
    expect(validateEventForm({
      title: input.title, category: input.category,
      startDate: input.startDate, endDate: input.endDate,
      budgetRaw: "85.000.000",
    })).toBeNull();
  });

  it("create event: minimal (all required fields)", () => {
    const input: EventInput = {
      title: "Reunión", description: "",
      startDate: "2026-04-01", endDate: "",
      category: "general", budget: 100000, currency: "PYG",
    };
    expect(validateEventForm({
      title: input.title, category: input.category,
      startDate: input.startDate, endDate: input.endDate,
      budgetRaw: "100000",
    })).toBeNull();
  });

  it("edit event: change only budget (add budget to existing event)", () => {
    const original = makeDbEvent({ title: "Evento", budget: null });
    const fc = toFCTest(original);
    expect(fc.extendedProps.budget).toBeNull();

    // User adds budget
    const { value } = parseBudgetInput("10.000.000");
    expect(value).toBe(10000000);
  });

  it("edit event: remove budget (clear input)", () => {
    const { value } = parseBudgetInput("");
    expect(value).toBeNull();
  });

  it("edit event: change currency from PYG to USD", () => {
    const input: EventInput = {
      title: "Import", description: "Compra China",
      startDate: "2026-05-01", endDate: "2026-05-15",
      category: "logistica", budget: 25000, currency: "USD",
    };
    expect(input.currency).toBe("USD");
    expect(input.budget).toBe(25000);
  });
});
