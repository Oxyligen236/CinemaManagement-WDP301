"use client";

import {
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createMovie,
  Genre,
  MSG02,
  MSG08,
  MSG09,
  MSG10,
  MSG11,
  POSTER_ACCEPTED_TYPES,
  POSTER_MAX_SIZE,
  uploadMovieAsset,
} from "../api";
import { X } from "lucide-react";
import { getFriendlyErrorMessage } from "@/lib/utils/error-handler";

interface Props {
  genres: Genre[];
  onClose: () => void;
  onCreated: () => void;
}

type FieldKey = "movieName" | "duration" | "genreIds" | "trailerUrl";

function isValidTrailerUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const inputClass = (invalid: boolean) =>
  `h-[40px] w-full border bg-[#fcfbfa] px-3 text-[13px] text-[#231f20] placeholder:text-[#9d9580] focus:outline-none focus:ring-1 focus:border-[#da291c] focus:ring-[#da291c] ${
    invalid ? "border-[#da291c]" : "border-[#dad2b4]"
  }`;

export default function CreateFilmModal({ genres, onClose, onCreated }: Props) {
  const [movieName, setMovieName] = useState("");
  const [duration, setDuration] = useState("");
  const [genreIds, setGenreIds] = useState<string[]>([]);
  const [releaseDate, setReleaseDate] = useState("");
  const [description, setDescription] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [posterKey, setPosterKey] = useState("");
  const [posterPreview, setPosterPreview] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterUploading, setPosterUploading] = useState(false);
  const [posterError, setPosterError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef("");
  const uploadIdRef = useRef(0);

  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const revokeBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = "";
    }
  }, []);

  useEffect(() => revokeBlob, [revokeBlob]);

  async function uploadPoster(file: File) {
    const uploadId = ++uploadIdRef.current;
    setPosterError("");
    setPosterKey("");
    setPosterUploading(true);
    try {
      const result = await uploadMovieAsset(file);
      if (uploadId !== uploadIdRef.current) return;
      setPosterKey(result.storageKey);
      setPreviewFailed(false);
      setPosterPreview(result.url);
      revokeBlob();
    } catch (error) {
      if (uploadId !== uploadIdRef.current) return;
      setPosterError(
        getFriendlyErrorMessage(
          error,
          "Tải áp phích lên máy chủ thất bại.",
        ),
      );
    } finally {
      if (uploadId === uploadIdRef.current) {
        setPosterUploading(false);
      }
    }
  }

  function selectPosterFile(file: File | undefined) {
    if (!file) return;
    if (!POSTER_ACCEPTED_TYPES.includes(file.type)) {
      setPosterError(MSG08);
      return;
    }
    if (file.size > POSTER_MAX_SIZE) {
      setPosterError(MSG09);
      return;
    }
    revokeBlob();
    blobUrlRef.current = URL.createObjectURL(file);
    setPreviewFailed(false);
    setPosterPreview(blobUrlRef.current);
    setPosterFile(file);
    void uploadPoster(file);
  }

  function removePoster() {
    uploadIdRef.current++;
    revokeBlob();
    setPosterPreview("");
    setPreviewFailed(false);
    setPosterFile(null);
    setPosterKey("");
    setPosterError("");
    setPosterUploading(false);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    if (posterUploading) return;
    const file = event.dataTransfer.files[0];
    selectPosterFile(file);
  }

  function toggleGenre(id: string) {
    setGenreIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || posterUploading) return;
    const nextErrors: Partial<Record<FieldKey, string>> = {};
    if (!movieName.trim()) nextErrors.movieName = MSG02.replace("*", "title");
    if (!duration || Number(duration) < 1)
      nextErrors.duration = MSG02.replace("*", "duration");
    if (genreIds.length === 0)
      nextErrors.genreIds = MSG02.replace("*", "genre");
    const trailer = trailerUrl.trim();
    if (trailer && !isValidTrailerUrl(trailer)) {
      nextErrors.trailerUrl = MSG11;
    }
    setErrors(nextErrors);
    setSubmitError("");

    const posterPending = Boolean(posterFile && !posterKey);
    if (posterPending) {
      setPosterError(posterError || MSG10);
    }
    if (Object.keys(nextErrors).length > 0 || posterPending) return;

    setSubmitting(true);
    try {
      await createMovie({
        movieName: movieName.trim(),
        duration: Number(duration),
        genreIds,
        releaseDate: releaseDate || undefined,
        description: description.trim() || undefined,
        posterKey: posterKey || undefined,
        trailerUrl: trailer || undefined,
      });
      onCreated();
    } catch (error) {
      setSubmitError(
        getFriendlyErrorMessage(
          error,
          "Không thể tạo phim. Vui lòng kiểm tra lại thông tin.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-film-title"
    >
      <form
        noValidate
        onSubmit={handleSubmit}
        className="w-full max-w-2xl border border-[#dad2b4] bg-white font-['Arial',sans-serif] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#dad2b4] bg-[#efebdb] px-5 py-3">
          <h2
            id="create-film-title"
            className="text-[14px] font-bold uppercase text-[#231f20]"
          >
            Tạo phim mới
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Đóng"
            className="cursor-pointer text-[#6f6247] hover:text-[#231f20]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#6f6247]">
              Tên phim *
            </span>
            <input
              value={movieName}
              onChange={(e) => setMovieName(e.target.value)}
              aria-invalid={!!errors.movieName}
              aria-describedby={errors.movieName ? "err-name" : undefined}
              className={inputClass(!!errors.movieName)}
            />
            {errors.movieName && (
              <p id="err-name" className="mt-1 text-xs text-[#da291c]">
                {errors.movieName}
              </p>
            )}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#6f6247]">
              Thời lượng (phút) *
            </span>
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              aria-invalid={!!errors.duration}
              aria-describedby={errors.duration ? "err-duration" : undefined}
              className={inputClass(!!errors.duration)}
            />
            {errors.duration && (
              <p id="err-duration" className="mt-1 text-xs text-[#da291c]">
                {errors.duration}
              </p>
            )}
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#6f6247]">
              Thể loại *
            </legend>
            <div
              className={`flex flex-wrap gap-2 border bg-[#fcfbfa] p-2 ${
                errors.genreIds ? "border-[#da291c]" : "border-[#dad2b4]"
              }`}
            >
              {genres.map((genre) => (
                <label
                  key={genre.genreId}
                  className="flex cursor-pointer items-center gap-1.5 border border-[#dad2b4] bg-white px-2.5 py-1 text-[13px] text-[#231f20]"
                >
                  <input
                    type="checkbox"
                    checked={genreIds.includes(genre.genreId)}
                    onChange={() => toggleGenre(genre.genreId)}
                    className="accent-[#da291c]"
                  />
                  {genre.genreName}
                </label>
              ))}
            </div>
            {errors.genreIds && (
              <p className="mt-1 text-xs text-[#da291c]">
                {errors.genreIds}
              </p>
            )}
          </fieldset>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#6f6247]">
              Ngày công chiếu
            </span>
            <input
              type="date"
              value={releaseDate}
              onChange={(e) => setReleaseDate(e.target.value)}
              className={inputClass(false)}
            />
          </label>
          <div className="sm:col-span-2">
            <span
              id="poster-label"
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#6f6247]"
            >
              Poster (JPG, PNG, WEBP, tối đa 5MB)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                selectPosterFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {posterPreview ? (
              <div className="flex items-start gap-4">
                {previewFailed ? (
                  <div
                    role="img"
                    aria-label="Không thể hiển thị ảnh xem trước"
                    className="flex h-40 w-28 items-center justify-center border border-[#dad2b4] bg-[#efebdb] px-2 text-center text-xs text-[#6f6247]"
                  >
                    Không thể hiển thị ảnh
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={posterPreview}
                    alt="Xem trước poster"
                    onError={() => setPreviewFailed(true)}
                    className="h-40 w-28 border border-[#dad2b4] object-cover"
                  />
                )}
                <div className="flex flex-col items-start gap-2">
                  {posterUploading && (
                    <p className="text-[13px] text-[#666]" role="status">
                      Đang tải ảnh lên...
                    </p>
                  )}
                  {!posterUploading && posterKey && (
                    <p className="text-[13px] text-[#15803d]" role="status">
                      Đã tải ảnh lên.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {!posterUploading && posterFile && !posterKey && (
                      <button
                        type="button"
                        onClick={() => void uploadPoster(posterFile)}
                        className="h-9 cursor-pointer border border-[#dad2b4] bg-white px-3 text-[12px] font-bold text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20]"
                      >
                        Thử lại
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={posterUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 cursor-pointer border border-[#dad2b4] bg-white px-3 text-[12px] font-bold text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Thay đổi ảnh
                    </button>
                    <button
                      type="button"
                      onClick={removePoster}
                      className="h-9 cursor-pointer border border-[#fecaca] bg-white px-3 text-[12px] font-bold text-[#da291c] hover:bg-[#fef2f2]"
                    >
                      Xóa ảnh
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                aria-labelledby="poster-label"
                aria-describedby="poster-hint"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`flex h-32 w-full flex-col items-center justify-center gap-1 border-2 border-dashed px-3 text-[13px] transition-colors motion-reduce:transition-none ${
                  dragging
                    ? "border-[#da291c] bg-[#efebdb]"
                    : "border-[#dad2b4] bg-[#fcfbfa] hover:bg-[#efebdb]"
                }`}
              >
                <span className="font-bold text-[#231f20]">
                  Kéo thả ảnh vào đây hoặc bấm để chọn file
                </span>
                <span id="poster-hint" className="text-xs text-[#9d9580]">
                  JPG, PNG hoặc WEBP, tối đa 5MB
                </span>
              </button>
            )}
            <p
              aria-live="polite"
              className={
                posterError ? "mt-1 text-xs text-[#da291c]" : "sr-only"
              }
            >
              {posterError}
            </p>
          </div>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#6f6247]">
              Link trailer
            </span>
            <input
              type="url"
              value={trailerUrl}
              onChange={(e) => setTrailerUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              aria-invalid={!!errors.trailerUrl}
              aria-describedby={errors.trailerUrl ? "err-trailer" : undefined}
              className={inputClass(!!errors.trailerUrl)}
            />
            {errors.trailerUrl && (
              <p id="err-trailer" className="mt-1 text-xs text-[#da291c]">
                {errors.trailerUrl}
              </p>
            )}
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#6f6247]">
              Mô tả
            </span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-[#dad2b4] bg-[#fcfbfa] px-3 py-2 text-[13px] text-[#231f20] focus:border-[#da291c] focus:outline-none focus:ring-1 focus:ring-[#da291c]"
            />
          </label>
        </div>
        {submitError && (
          <p role="alert" className="mt-4 text-[13px] text-[#da291c]">
            {submitError}
          </p>
        )}
        <div className="flex justify-end gap-3 border-t border-[#dad2b4] bg-[#efebdb] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-[38px] cursor-pointer items-center border border-[#dad2b4] bg-white px-4 text-[13px] font-bold text-[#6f6247] transition-colors hover:bg-[#dad2b4] hover:text-[#231f20]"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting || posterUploading}
            className="inline-flex h-[38px] cursor-pointer items-center bg-[#da291c] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#b82116] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}
