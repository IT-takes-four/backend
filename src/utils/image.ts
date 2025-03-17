import { ImageSourceEnum } from "../db/schema";

export enum IgdbImageSize {
  COVER_SMALL = "cover_small", // 90x128
  COVER_BIG = "cover_big", // 264x374
  SCREENSHOT_MED = "screenshot_med", // 569x320
  SCREENSHOT_BIG = "screenshot_big", // 889x500
  SCREENSHOT_HUGE = "screenshot_huge", // 1280x720
  LOGO_MED = "logo_med", // 284x160
  THUMB = "thumb", // 90x90
  MICRO = "micro", // 35x35
  HD = "720p", // 1280x720
  FULL_HD = "1080p", // 1920x1080
}

export const getIgdbImageUrl = (
  hash: string,
  size: IgdbImageSize = IgdbImageSize.COVER_BIG
): string => {
  if (!hash) return "";
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${hash}.jpg`;
};

export const getImageUrl = (
  source: string,
  hash: string,
  size: IgdbImageSize = IgdbImageSize.COVER_BIG
): string => {
  if (!hash) return "";

  if (source === ImageSourceEnum.IGDB) {
    return getIgdbImageUrl(hash, size);
  } else if (source === ImageSourceEnum.LOCAL) {
    // TODO: Replace with S3 URL structure
    return `https://your-s3-bucket.s3.amazonaws.com/images/${hash}.jpg`;
  }

  return "";
};

export const isExternalUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
};
