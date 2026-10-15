import { describe, it, expect } from "vitest";
import { isHexColor, contrastRatio, pickForeground, liftForDark, buildBrandCss, colorWarnings } from "./brandTheme";

describe("isHexColor", () => {
    it("accepts only #RRGGBB", () => {
        expect(isHexColor("#159bff")).toBe(true);
        expect(isHexColor("#fff")).toBe(false);
        expect(isHexColor("red")).toBe(false);
        expect(isHexColor("#159bff; } body { display:none")).toBe(false);
        expect(isHexColor(null)).toBe(false);
    });
});

describe("pickForeground", () => {
    it("uses white on dark colors and black on light colors", () => {
        expect(pickForeground("#0b1f3a")).toBe("#ffffff");
        expect(pickForeground("#ffe600")).toBe("#000000");
    });
});

describe("liftForDark", () => {
    it("leaves a color that already reads on dark unchanged", () => {
        expect(liftForDark("#3b82f6")).toBe("#3b82f6");
    });

    it("lightens a dark color until it reads on the dark background", () => {
        const lifted = liftForDark("#1d3a8a");
        expect(lifted).not.toBe("#1d3a8a");
        expect(contrastRatio(lifted, "#1c1c1f")).toBeGreaterThanOrEqual(4.5);
    });
});

describe("buildBrandCss", () => {
    it("returns an empty string without a valid primary color", () => {
        expect(buildBrandCss({ primaryColor: null, accentColor: null })).toBe("");
        expect(buildBrandCss({ primaryColor: "javascript:1", accentColor: null })).toBe("");
    });

    it("emits light and dark rules that override accent and primary", () => {
        const css = buildBrandCss({ primaryColor: "#ff5500", accentColor: null });
        expect(css).toContain("html:root{");
        expect(css).toContain("html.dark:root{");
        expect(css).toContain("--accent:#ff5500");
        expect(css).toContain("--primary:#ff5500");
        expect(css).not.toContain("--brand-secondary");
    });

    it("drops an invalid accent color instead of emitting it", () => {
        const css = buildBrandCss({ primaryColor: "#ff5500", accentColor: "not-a-color" });
        expect(css).not.toContain("--brand-secondary");
    });

    it("includes a valid accent as --brand-secondary", () => {
        const css = buildBrandCss({ primaryColor: "#ff5500", accentColor: "#00aa88" });
        expect(css).toContain("--brand-secondary:#00aa88");
    });
});

describe("colorWarnings", () => {
    it("warns for near-white and near-black, not for a readable mid tone", () => {
        expect(colorWarnings("#fafafa")).toContain("lightBackground");
        expect(colorWarnings("#0a0a0a")).toContain("darkBackground");
        expect(colorWarnings("#2563eb")).toEqual([]);
        expect(colorWarnings(null)).toEqual([]);
    });
});
