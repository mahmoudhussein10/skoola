export const mediaResourceTypes = ["video", "image", "logo", "hero", "course_cover", "profile_image", "pdf", "attachment"] as const;
export type MediaResourceType = (typeof mediaResourceTypes)[number];
export type MediaProvider = "BUNNY_STREAM" | "BUNNY_STORAGE";
export type MediaUploadStatus = "PENDING" | "UPLOADING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type MediaProcessingStatus = "WAITING" | "PROCESSING" | "READY" | "FAILED";

export type BunnyStreamVideo = {
  videoLibraryId: number;
  guid: string;
  title: string;
  dateUploaded?: string;
  views?: number;
  isPublic?: boolean;
  length?: number;
  status?: number;
  encodeProgress?: number;
  width?: number;
  height?: number;
  availableResolutions?: string;
  thumbnailFileName?: string;
  collectionId?: string;
};

export type BunnyStreamCollection = { guid: string; name: string; videoLibraryId?: number };

export type TusUploadCredentials = {
  mediaId: string;
  endpoint: string;
  videoId: string;
  libraryId: string;
  expirationTime: number;
  signature: string;
  embedUrl: string;
};