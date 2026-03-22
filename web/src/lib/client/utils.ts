/**
 * Generates initials from a user's name.
 * Takes up to the first two words, and returns their first letters capitalized.
 * E.g., "Vova Stelmashchuk" -> "VS", "Alice" -> "A".
 */
export function getInitials(name: string): string {
	if (!name) return '?';
	const parts = name.trim().split(/\s+/);
	if (parts.length === 1) {
		return parts[0].charAt(0).toUpperCase();
	}
	return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}
