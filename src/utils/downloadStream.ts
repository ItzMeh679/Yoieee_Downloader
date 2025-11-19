export async function streamDownload(
  url: string,
  onProgress: (percent: number) => void,
  abortController: AbortController
) {
  const res = await fetch(url, {
    method: "POST",
    signal: abortController.signal,
  });

  if (!res.ok) throw new Error("Network error");

  const contentDisposition = res.headers.get("content-disposition") || "";
  const match = contentDisposition.match(/filename="(.+)"/);
  const filename = match ? match[1] : "video.mp4";

  const reader = res.body!.getReader();

  // FIXED TYPE HERE:
  const chunks: BlobPart[] = [];

  let received = 0;
  const contentLength = Number(res.headers.get("Content-Length")) || 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value as BlobPart); // FIX
    received += value?.length || 0;

    if (contentLength > 0) {
      onProgress(Math.floor((received / contentLength) * 100));
    }
  }

  const blob = new Blob(chunks, { type: "video/mp4" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();
}
