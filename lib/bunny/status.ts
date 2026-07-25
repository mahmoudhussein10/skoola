export function mapStreamState(status?: number) {
  // Bunny marks the complete video as 3 (Finished); 4 means a playable resolution finished.
  if (status === 3 || status === 4) {
    return { processingStatus: "READY", uploadStatus: "COMPLETED" } as const;
  }
  if (status === 5 || status === 8) {
    return { processingStatus: "FAILED", uploadStatus: "FAILED" } as const;
  }
  return {
    processingStatus: "PROCESSING",
    uploadStatus: status === 6 ? "UPLOADING" : "COMPLETED",
  } as const;
}
