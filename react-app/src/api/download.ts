/**
 * Authenticated binary downloads.
 *
 * A plain <a href> cannot carry the bearer token, so protected files are
 * fetched and handed to the browser as a blob. The helper is shared by the
 * quotation PDF, supplier attachments and COD receipts.
 */
import { API_BASE_URL, type ApiResponse } from './client';

export interface DownloadedFile {
  blob: Blob;
  fileName: string;
}

export async function downloadAuthorizedFile(
  path: string,
  fallbackName: string,
): Promise<ApiResponse<DownloadedFile>> {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: 'application/pdf,application/octet-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    let message = 'The file could not be downloaded.';

    try {
      const data = (await response.json()) as { message?: string };
      message = data.message ?? message;
    } catch {
      // Binary or empty error body.
    }

    return { success: false, message, status: response.status };
  }

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const plain = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  const fileName = encoded
    ? decodeURIComponent(encoded)
    : plain
      ? plain.replace(/\\/g, '')
      : fallbackName;

  return {
    success: true,
    data: { blob: await response.blob(), fileName },
    status: response.status,
  };
}
