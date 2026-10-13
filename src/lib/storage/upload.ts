import { createClient } from "@/lib/supabase/client";

export interface UploadCoverResult {
  publicUrl: string | null;
  error: string | null;
}

/**
 * Converts a base64 string or data URL to a Uint8Array byte array for upload
 */
export function base64ToUint8Array(base64String: string): { bytes: Uint8Array; mimeType: string } {
  let cleanBase64 = base64String;
  let mimeType = "image/jpeg";

  if (base64String.includes(",")) {
    const [header, data] = base64String.split(",");
    cleanBase64 = data;
    const match = header.match(/:(.*?);/);
    if (match) {
      mimeType = match[1];
    }
  }

  // Handle binary conversion
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return { bytes, mimeType };
}

/**
 * Uploads a compressed cover image to Supabase Storage in the 'covers' bucket
 */
export async function uploadCoverImage(
  base64OrDataUrl: string,
  userId?: string
): Promise<UploadCoverResult> {
  try {
    const supabase = createClient();

    // Verify user ID if not provided
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      effectiveUserId = user?.id || "anonymous";
    }

    const { bytes, mimeType } = base64ToUint8Array(base64OrDataUrl);
    const extension = mimeType.split("/")[1] || "jpg";
    const filename = `${effectiveUserId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("covers")
      .upload(filename, bytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      return { publicUrl: null, error: uploadError.message };
    }

    const { data: urlData } = supabase.storage
      .from("covers")
      .getPublicUrl(filename);

    return { publicUrl: urlData.publicUrl, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Błąd podczas przesyłania okładki.";
    return { publicUrl: null, error: message };
  }
}
