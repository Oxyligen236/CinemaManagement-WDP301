import { getFriendlyErrorMessage } from "@/lib/utils/error-handler";

export type MovieStatus = "COMING_SOON" | "NOW_SHOWING" | "ENDED";

export interface Movie {
  movieId: string;
  movieName: string;
  duration: number;
  status: MovieStatus;
  posterKey?: string;
  posterUrl?: string;
  trailerUrl?: string;
  description?: string;
  releaseDate?: string;
  isActive: boolean;
  genreIds: string[];
}

export interface Genre {
  genreId: string;
  genreName: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateFilmPayload {
  movieName: string;
  duration: number;
  genreIds: string[];
  releaseDate?: string;
  description?: string;
  posterKey?: string;
  trailerUrl?: string;
}

export interface UploadMovieAssetRes {
  storageKey: string;
  url: string;
  originalName: string;
  size: number;
  contentType: string;
}

export const POSTER_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const POSTER_MAX_SIZE = 5 * 1024 * 1024;

export const MSG01 = "No search results.";
export const MSG02 = "The * field is required.";
export const MSG08 =
  "File format is not supported. Please upload JPG, PNG, or WEBP.";
export const MSG09 = "File size exceeds maximum allowed limit (5MB).";
export const MSG10 = "Failed to upload asset to storage service.";
export const MSG11 = "Invalid trailer link.";
export const MSG07 =
  "Cannot deactivate film with scheduled or ongoing showtimes.";

export const STATUS_LABEL: Record<MovieStatus, string> = {
  COMING_SOON: "Sắp chiếu",
  NOW_SHOWING: "Đang chiếu",
  ENDED: "Đã kết thúc",
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem("cinema_access_token");
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    // localStorage unavailable
  }
  return {};
}

async function send<T>(path: string, init: RequestInit): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";
  const response = await fetch(`${apiUrl}${path}`, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const rawMessage = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message;
    const message = getFriendlyErrorMessage(
      { status: response.status, message: rawMessage },
      "Yêu cầu không thành công.",
    );
    throw new ApiError(message, response.status);
  }
  return body as T;
}

function request<T>(path: string, init?: RequestInit): Promise<T> {
  return send<T>(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
}

/** Multipart upload: Content-Type is left unset so the browser adds the boundary. */
export function uploadMovieAsset(file: File): Promise<UploadMovieAssetRes> {
  const formData = new FormData();
  formData.append("file", file);
  return send("/movies/assets/upload", {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
}

export function fetchMovies(params: {
  keyword?: string;
  genreId?: string;
  status?: string;
  page: number;
  limit: number;
}): Promise<PageResult<Movie>> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return request(`/movies?${query.toString()}`);
}

export function fetchGenres(): Promise<Genre[]> {
  return request("/movies/genres");
}

export function createMovie(payload: CreateFilmPayload): Promise<Movie> {
  return request("/movies", { method: "POST", body: JSON.stringify(payload) });
}

export function deactivateMovie(movieId: string): Promise<Movie> {
  return request(`/movies/${movieId}/deactivate`, { method: "PATCH" });
}
