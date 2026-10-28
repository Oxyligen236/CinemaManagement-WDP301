'use client';

import { KeyboardEvent, UIEvent, useEffect, useState } from 'react';
import { fetchMovieOptions, MovieChoice, MovieOption } from '../api';

interface Props {
  id: string;
  value: MovieChoice | null;
  invalid?: boolean;
  disabled?: boolean;
  /** Filter bars pass an "all movies" label and may clear the selection. */
  clearLabel?: string;
  height?: 'h-[38px]' | 'h-[42px]';
  onChange: (movie: MovieChoice | null) => void;
}

const SEARCH_DEBOUNCE_MS = 300;
const OPTION_LIMIT = 20;
const SCROLL_THRESHOLD_PX = 24;

export default function MovieSearchSelect({
  id,
  value,
  invalid = false,
  disabled,
  clearLabel,
  height = 'h-[42px]',
  onChange,
}: Props) {
  const listId = `${id}-listbox`;
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<MovieOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pageNo, setPageNo] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(
      () => {
        setLoading(true);
        fetchMovieOptions((query ?? '').trim(), 1, OPTION_LIMIT)
          .then((result) => {
            if (cancelled) return;
            setOptions(result.items);
            setPageNo(1);
            setTotalPages(result.totalPages);
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

  function handleScroll(event: UIEvent<HTMLUListElement>) {
    const list = event.currentTarget;
    const nearBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight <=
      SCROLL_THRESHOLD_PX;
    if (!nearBottom || loading || loadingMore || pageNo >= totalPages) return;

    const nextPage = pageNo + 1;
    setLoadingMore(true);
    fetchMovieOptions((query ?? '').trim(), nextPage, OPTION_LIMIT)
      .then((result) => {
        setOptions((prev) => {
          const seen = new Set(prev.map((item) => item.movieId));
          return [...prev, ...result.items.filter((i) => !seen.has(i.movieId))];
        });
        setPageNo(nextPage);
        setTotalPages(result.totalPages);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoadingMore(false));
  }

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
      case 'ArrowDown':
        event.preventDefault();
        if (!open) {
          setOpen(true);
        } else if (options.length > 0) {
          setActiveIndex((i) => (i + 1) % options.length);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (open && options.length > 0) {
          setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
        }
        break;
      case 'Enter':
        if (open && activeIndex >= 0 && options[activeIndex]) {
          event.preventDefault();
          select(options[activeIndex]);
        }
        break;
      case 'Escape':
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
  const borderClass = invalid ? 'border-[#da291c]' : 'border-[#dad2b4]';

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
        disabled={disabled}
        placeholder={clearLabel ?? 'Gõ để tìm phim'}
        value={query ?? value?.movieName ?? ''}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={handleKeyDown}
        className={`w-full ${height} border ${borderClass} bg-[#fcfbfa] px-3 text-[13px] font-semibold text-[#231f20] placeholder:font-normal placeholder:text-[#9d9580] focus:border-[#da291c] focus:outline-none disabled:cursor-not-allowed disabled:opacity-70`}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Danh sách phim"
          onScroll={handleScroll}
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto border border-[#dad2b4] bg-white py-1 shadow-lg"
        >
          {clearLabel && value && (
            <li
              role="option"
              aria-selected={false}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(null);
                close();
              }}
              className="cursor-pointer px-3 py-2 text-[13px] font-semibold text-[#6f6247] hover:bg-[#efebdb]"
            >
              {clearLabel}
            </li>
          )}
          {loading && (
            <li role="presentation" className="px-3 py-2 text-[13px] text-[#666]">
              Đang tải...
            </li>
          )}
          {!loading && failed && (
            <li
              role="presentation"
              className="px-3 py-2 text-[13px] font-semibold text-[#da291c]"
            >
              Không thể tải danh sách phim.
            </li>
          )}
          {showEmpty && (
            <li role="presentation" className="px-3 py-2 text-[13px] text-[#666]">
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
                className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-[13px] text-[#231f20] ${
                  index === activeIndex ? 'bg-[#efebdb]' : ''
                } ${option.movieId === value?.movieId ? 'font-bold' : ''}`}
              >
                <span className="truncate">{option.movieName}</span>
                <span className="shrink-0 text-[12px] text-[#6f6247]">
                  {option.duration} phút
                </span>
              </li>
            ))}
          {loadingMore && (
            <li role="presentation" className="px-3 py-2 text-[13px] text-[#666]">
              Đang tải thêm...
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
