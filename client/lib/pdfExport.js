import api from "@/lib/axios";

// downloadPdfExport's error response arrives as an unparsed Blob (the request
// used responseType: "blob" so a successful PDF isn't mangled as text) — the
// JSON error body the server actually sent (e.g. "Internal server error" vs
// a permission message) is otherwise invisible, since callers used to catch
// with a bare `catch {}` that discarded it entirely. Callers should log this,
// not necessarily show it to the user — the user-facing message can stay
// generic while this makes the real cause visible in the console/telemetry.
export async function describePdfExportError(err) {
    const status = err?.response?.status ?? null;
    const data = err?.response?.data;
    if (data instanceof Blob) {
        try {
            const text = await data.text();
            const parsed = JSON.parse(text);
            return { status, message: parsed?.error || parsed?.message || text };
        } catch {
            return { status, message: err?.message || "Unknown error" };
        }
    }
    return { status, message: data?.error || data?.message || err?.message || "Unknown error" };
}

// Shared by the nutrition and training builder pages' Export PDF buttons —
// requests the file as a blob (not JSON) and triggers a normal browser
// download via a throwaway <a>, since the export endpoint streams
// application/pdf rather than returning a URL to redirect to.
export async function downloadPdfExport(kind, planId, filenameFallback) {
    const res = await api.get(`/api/pdf-export/${kind}/${planId}`, { responseType: "blob" });
    const blobUrl = URL.createObjectURL(res.data);

    const disposition = res.headers?.["content-disposition"] || "";
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] || filenameFallback;

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
}
