/**
 * Safely parse a Fetch API Response as JSON without throwing raw SyntaxError on non-JSON responses.
 */
export async function parseJsonSafe<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  if (!text) {
    return {} as T;
  }

  if (contentType.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      return JSON.parse(text) as T;
    } catch {
      // Fall through to structured error
    }
  }

  const preview = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
  throw new Error(
    `Server mengembalikan respons non-JSON (HTTP ${res.status}): ${preview || 'Silakan periksa koneksi atau deployment API server.'}`
  );
}
