import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";

/**
 * Issues short-lived client upload tokens so the browser can upload media
 * (especially large videos) DIRECTLY to Vercel Blob, bypassing the ~4.5MB
 * serverless function body limit. The post itself is created separately with
 * the returned blob URL (see /api/posts + the composer).
 */
export async function POST(req: Request): Promise<Response> {
  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/*", "video/*", "audio/*"],
        maximumSizeInBytes: 500 * 1024 * 1024, // 500MB
        addRandomSuffix: true,
      }),
      // The post row is written by /api/posts once the client has the URL.
      onUploadCompleted: async () => {},
    });
    return Response.json(json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return Response.json({ error: msg }, { status: 400 });
  }
}
