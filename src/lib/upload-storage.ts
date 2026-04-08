import path from "path";
import type { UploadPurpose } from "@/lib/file-upload-security";

const UPLOAD_TYPE_ALIASES: Record<string, UploadPurpose> = {
  profile: "profilePhoto",
  profilephoto: "profilePhoto",
  "profile-photo": "profilePhoto",
  iddocument: "idDocument",
  "id-document": "idDocument",
  profession: "idDocument",
  tournamentgallery: "tournamentGallery",
  "tournament-gallery": "tournamentGallery",
  contractpdf: "contractPdf",
  "contract-pdf": "contractPdf",
  orglogo: "orgLogo",
  "org-logo": "orgLogo",
  general: "general",
};

export function resolveUploadPurpose(input: string | null | undefined): UploadPurpose | null {
  if (!input) {
    return null;
  }

  const normalized = input.trim().toLowerCase();
  return UPLOAD_TYPE_ALIASES[normalized] ?? null;
}

export function getAbsoluteUploadPath(relativePath: string): string {
  return path.join(process.cwd(), relativePath);
}

export function getUploadRoute(fileId: string): string {
  return `/api/upload/${fileId}`;
}

export function isPublicUploadPurpose(purpose: UploadPurpose): boolean {
  return purpose === "profilePhoto" || purpose === "orgLogo" || purpose === "tournamentGallery";
}
