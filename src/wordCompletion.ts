import commonWordsJson from "./data/commonWords.json";

const commonWords: string[] = commonWordsJson as string[];

/**
 * Returns the completion tail for the current word fragment using the wordlist-english library.
 * E.g. "hel" -> "lo" (for "hello"), "wor" -> "ld" (for "world").
 * Empty string if no match or fragment too short.
 */
export function getWordCompletion(fragment: string): string {
  const trimmed = fragment.trim();
  if (trimmed.length < 2 || commonWords.length === 0) return "";
  const lower = trimmed.toLowerCase();
  for (const word of commonWords) {
    if (word.length > lower.length && word.toLowerCase().startsWith(lower)) {
      return word.slice(trimmed.length);
    }
  }
  return "";
}
