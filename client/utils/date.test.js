import { describe, test, expect } from "vitest";
import { formatDate, formatDateTime } from "./date";

// Use explicit local-time constructor args so the assertions don't depend on
// the test runner's timezone.
const at = (y, mZeroBased, d, h = 0, min = 0) => new Date(y, mZeroBased, d, h, min);

describe("formatDate — English", () => {
    test("renders D MMM YYYY", () => {
        expect(formatDate(at(2024, 2, 4), "en")).toBe("4 Mar 2024");
        expect(formatDate(at(2026, 5, 22), "en")).toBe("22 Jun 2026");
        expect(formatDate(at(2026, 11, 15), "en")).toBe("15 Dec 2026");
    });

    test("defaults to English when no locale is given", () => {
        expect(formatDate(at(2024, 2, 4))).toBe("4 Mar 2024");
    });

    test("does not zero-pad the day", () => {
        expect(formatDate(at(2024, 0, 1), "en")).toBe("1 Jan 2024");
    });

    test("accepts an ISO string", () => {
        expect(formatDate("2024-03-04T10:00:00", "en")).toBe("4 Mar 2024");
    });

    test("returns empty string for missing or invalid input", () => {
        expect(formatDate(null, "en")).toBe("");
        expect(formatDate(undefined, "en")).toBe("");
        expect(formatDate("", "en")).toBe("");
        expect(formatDate("not-a-date", "en")).toBe("");
    });
});

describe("formatDate — Arabic", () => {
    test("renders localized month names with Western digits", () => {
        expect(formatDate(at(2024, 2, 4), "ar")).toBe("4 مارس 2024");
        expect(formatDate(at(2026, 5, 22), "ar")).toBe("22 يونيو 2026");
    });

    test("returns empty string for invalid input", () => {
        expect(formatDate(null, "ar")).toBe("");
    });
});

describe("formatDateTime — English", () => {
    test("renders D MMM YYYY, h:mm A", () => {
        expect(formatDateTime(at(2024, 2, 4, 15, 45), "en")).toBe("4 Mar 2024, 3:45 PM");
        expect(formatDateTime(at(2026, 5, 22, 10, 15), "en")).toBe("22 Jun 2026, 10:15 AM");
    });

    test("renders midnight as 12 AM and noon as 12 PM", () => {
        expect(formatDateTime(at(2024, 2, 4, 0, 5), "en")).toBe("4 Mar 2024, 12:05 AM");
        expect(formatDateTime(at(2024, 2, 4, 12, 0), "en")).toBe("4 Mar 2024, 12:00 PM");
    });

    test("zero-pads minutes but not the hour", () => {
        expect(formatDateTime(at(2024, 2, 4, 9, 3), "en")).toBe("4 Mar 2024, 9:03 AM");
    });

    test("returns empty string for missing or invalid input", () => {
        expect(formatDateTime(null, "en")).toBe("");
        expect(formatDateTime("nope", "en")).toBe("");
    });
});

describe("formatDateTime — Arabic", () => {
    test("uses Arabic month, comma and meridiem with Western digits", () => {
        expect(formatDateTime(at(2024, 2, 4, 15, 45), "ar")).toBe("4 مارس 2024، 3:45 م");
        expect(formatDateTime(at(2026, 5, 22, 10, 15), "ar")).toBe("22 يونيو 2026، 10:15 ص");
    });

    test("returns empty string for invalid input", () => {
        expect(formatDateTime(null, "ar")).toBe("");
    });
});
