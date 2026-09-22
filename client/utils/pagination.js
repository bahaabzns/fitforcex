// Builds a compact page-number list for a Pagination control: all pages when
// there are few, otherwise first + last + a window around the current page
// with "ellipsis" markers for the gaps. Shared by every paginated picker
// modal so they all collapse long page lists the same way.
export function getPageNumbers(currentPage, totalPages) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [1];
    if (currentPage > 3) pages.push("ellipsis");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
}
