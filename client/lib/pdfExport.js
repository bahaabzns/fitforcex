import api from "@/lib/axios";

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
