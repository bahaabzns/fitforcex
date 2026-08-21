// First letter of the first two words of a full name (e.g. "Bahaa Ahmed" -> "BA").
// Shared by every avatar-fallback usage that only has a single combined name
// string to work with (client_name, notification actor names, etc.) —
// messenger.js's getInitials(fname, lname) is a separate, already-split-field
// variant and stays local to that file.
export function getInitials(name) {
    if (!name) return null;
    const parts = name.trim().split(/\s+/);
    const initials = `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
    return initials || null;
}
