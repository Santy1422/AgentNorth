import { describe, it, expect } from "vitest";
import { en } from "@/i18n/en";
import { es } from "@/i18n/es";

describe("i18n translations", () => {
  const enKeys = Object.keys(en) as (keyof typeof en)[];
  const esKeys = Object.keys(es) as (keyof typeof es)[];

  it("every key in en exists in es", () => {
    const missing = enKeys.filter((k) => !(k in es));
    expect(missing).toEqual([]);
  });

  it("every key in es exists in en", () => {
    const extra = esKeys.filter((k) => !(k in en));
    expect(extra).toEqual([]);
  });

  it("en has no empty string values", () => {
    const empty = enKeys.filter((k) => en[k].trim() === "");
    expect(empty).toEqual([]);
  });

  it("es has no empty string values", () => {
    const empty = esKeys.filter((k) => es[k].trim() === "");
    expect(empty).toEqual([]);
  });

  it("variable placeholders in en also exist in es", () => {
    const placeholderRe = /\{[^}]+\}/g;
    const mismatches: string[] = [];

    for (const key of enKeys) {
      const enPlaceholders = (en[key].match(placeholderRe) || []).sort();
      const esPlaceholders = ((es[key] || "").match(placeholderRe) || []).sort();

      if (JSON.stringify(enPlaceholders) !== JSON.stringify(esPlaceholders)) {
        mismatches.push(
          `${key}: en=${JSON.stringify(enPlaceholders)} es=${JSON.stringify(esPlaceholders)}`,
        );
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("both languages have the same number of keys", () => {
    expect(enKeys.length).toBe(esKeys.length);
  });

  it("key count is greater than zero", () => {
    expect(enKeys.length).toBeGreaterThan(0);
  });
});
