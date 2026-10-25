"use client";

import { KeyboardEvent, useEffect, useState } from "react";
import { fetchMovieOptions, MovieChoice, MovieOption } from "../api";

interface Props {
  id: string;
  value: MovieChoice | null;
  invalid: boolean;
  describedBy?: string;
  disabled?: boolean;
  onChange: (movie: MovieChoice) => void;
}

const SEARCH_DEBOUNCE_MS = 300;
const OPTION_LIMIT = 10;

const inputClass = (invalid: boolean) =>
  `h-10 w-full rounded-lg border bg-white px-3 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-70 ${
    invalid
      ? "border-primary-600 focus:border-primary-600 focus:ring-primary-600"
      : "border-border-main focus:border-primary-600 focus:ring-primary-600"
  }`;

export default function MovieCombobox({
  id,
  value,
  invalid,
  describedBy,
  disabled,
  onChange,
}: Props) {
  const listId = `${id}-listbox`;
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<MovieOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(
      () => {
        setLoading(true);
        fetchMovieOptions((query ?? "").trim(), 1, OPTION_LIMIT)
          .then((result) => {
            if (cancelled) return;
            setOptions(result.items);
            setFailed(false);
            setActiveIndex(result.items.length > 0 ? 0 : -1);
          })
          .catch(() => {
            if (cancelled) return;
            setOptions([]);
            setFailed(true);
            setActiveIndex(-1);
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      },
      query ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  function select(option: MovieOption) {
    onChange({
      movieId: option.movieId,
      movieName: option.movieName,
      duration: option.duration,
      posterUrl: option.posterUrl,
    });
    setQuery(null);
    setOpen(false);
  }

  function close() {
    setOpen(false);
    setQuery(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) {
          setOpen(true);
        } else if (options.length > 0) {
          setActiveIndex((i) => (i + 1) % options.length);
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (open && options.length > 0) {
          setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
        }
        break;
      case "Enter":
        if (open && activeIndex >= 0 && options[activeIndex]) {
          event.preventDefault();
          select(options[activeIndex]);
        }
        break;
      case "Escape":
        if (open) {
          event.stopPropagation();
          close();
        }
        break;
      default:
    }
  }

  const activeId =
    open && activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined;
  const showEmpty = open && !loading && !failed && options.length === 0;

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        disabled={disabled}
        placeholder="Gõ để tìm phim"
        value={query ?? value?.movieName ?? ""}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={handleKeyDown}
        className={inputClass(invalid)}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Danh sách phim"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border-main bg-surface py-1 shadow-card"
        >
          {loading && (
            <li
              role="presentation"
              className="px-3 py-2 text-sm text-text-muted"
            >
              Đang tải...
            </li>
          )}
          {!loading && failed && (
            <li
              role="presentation"
              className="px-3 py-2 text-sm text-status-danger"
            >
              Không thể tải danh sách phim.
            </li>
          )}
          {showEmpty && (
            <li
              role="presentation"
              className="px-3 py-2 text-sm text-text-muted"
            >
              Không tìm thấy phim phù hợp.
            </li>
          )}
          {!loading &&
            options.map((option, index) => (
              <li
                key={option.movieId}
                id={`${id}-opt-${index}`}
                role="option"
                aria-selected={option.movieId === value?.movieId}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(option)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm text-text-main ${
                  index === activeIndex ? "bg-primary-50" : ""
                } ${option.movieId === value?.movieId ? "font-semibold" : ""}`}
              >
                <span className="truncate">{option.movieName}</span>
                <span className="shrink-0 text-xs text-text-muted">
                  {option.duration} phút
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
