import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError as FilmApiError,
  MSG01,
  MSG02,
  MSG07,
  MSG08,
  MSG09,
  MSG10,
  MSG11,
  POSTER_ACCEPTED_TYPES,
  POSTER_MAX_SIZE,
  STATUS_LABEL,
  createMovie,
  deactivateMovie,
  fetchGenres,
  fetchMovies,
  uploadMovieAsset,
} from '../films/api';
import {
  ApiError as MultiplierApiError,
  MAX_VALUES_PER_FIELD,
  MSG03,
  MSG_CREATE_SUCCESS,
  MSG_DELETE_SUCCESS,
  MSG_DUPLICATE_MULTIPLIER,
  MSG_INVALID_MULTIPLIER,
  MSG_LOAD_FAILED,
  MSG_MAX_VALUES,
  MSG_SAVE_FAILED,
  MULTIPLIER_MAX,
  MULTIPLIER_MIN,
  createPriceValue,
  deletePriceValue,
  fetchPriceFields,
  msg02,
  updatePriceValue,
  validateMultiplierInput,
} from '../price-multipliers/api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('app/admin/films/api', () => {
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalApiUrl !== undefined) {
      process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    } else {
      delete process.env.NEXT_PUBLIC_API_URL;
    }
  });

  it('exports expected constants and status labels', () => {
    expect(POSTER_ACCEPTED_TYPES).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    expect(POSTER_MAX_SIZE).toBe(5 * 1024 * 1024);
    expect(MSG01).toBeTruthy();
    expect(MSG02).toBeTruthy();
    expect(MSG07).toBeTruthy();
    expect(MSG08).toBeTruthy();
    expect(MSG09).toBeTruthy();
    expect(MSG10).toBeTruthy();
    expect(MSG11).toBeTruthy();
    expect(STATUS_LABEL).toEqual({
      COMING_SOON: 'Sắp chiếu',
      NOW_SHOWING: 'Đang chiếu',
      ENDED: 'Đã kết thúc',
    });

    const err = new FilmApiError('Lỗi', 400);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Lỗi');
    expect(err.status).toBe(400);
  });

  it('fetchMovies builds query string skipping undefined and empty params and sends auth header', async () => {
    localStorage.setItem('cinema_access_token', 'tok-123');
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    const expected = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    fetchMock.mockResolvedValueOnce(jsonResponse(expected));

    const res = await fetchMovies({
      keyword: 'avengers',
      genreId: '',
      status: undefined,
      page: 2,
      limit: 10,
    });

    expect(res).toEqual(expected);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/movies?keyword=avengers&page=2&limit=10',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer tok-123',
        },
      }),
    );
  });

  it('fetchGenres works without token and when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ genreId: 'g1', genreName: 'Hành động' }]),
    );

    const genres = await fetchGenres();
    expect(genres).toEqual([{ genreId: 'g1', genreName: 'Hành động' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8010/movies/genres',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('createMovie sends POST /movies with JSON payload', async () => {
    const payload = {
      movieName: 'Dune',
      duration: 155,
      genreIds: ['g1'],
      releaseDate: '2026-05-01',
    };
    const created = { ...payload, movieId: 'm1', status: 'COMING_SOON', isActive: true };
    fetchMock.mockResolvedValueOnce(jsonResponse(created, 201));

    const res = await createMovie(payload);
    expect(res).toEqual(created);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8010/movies',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    );
  });

  it('deactivateMovie sends PATCH /movies/:id/deactivate', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ movieId: 'm1', isActive: false }),
    );

    const res = await deactivateMovie('m1');
    expect(res).toEqual({ movieId: 'm1', isActive: false });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8010/movies/m1/deactivate',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('uploadMovieAsset posts FormData without Content-Type header', async () => {
    localStorage.setItem('cinema_access_token', 'tok-up');
    const file = new File(['abc'], 'poster.png', { type: 'image/png' });
    const uploaded = {
      storageKey: 'k1',
      url: 'https://cdn/k1.png',
      originalName: 'poster.png',
      size: 3,
      contentType: 'image/png',
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(uploaded, 201));

    const res = await uploadMovieAsset(file);
    expect(res).toEqual(uploaded);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8010/movies/assets/upload');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: 'Bearer tok-up' });
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('maps array, string, and non-JSON error bodies into FilmApiError', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: ['Lỗi một', 'Lỗi hai'] }, 400),
    );
    await expect(fetchGenres()).rejects.toMatchObject({
      name: 'Error',
      status: 400,
      message: 'Lỗi một, Lỗi hai',
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'Raw error' }, 404),
    );
    await expect(fetchGenres()).rejects.toMatchObject({
      status: 404,
      message: 'Không tìm thấy dữ liệu yêu cầu.',
    });

    fetchMock.mockResolvedValueOnce(
      new Response('not-json', { status: 418 }),
    );
    await expect(fetchGenres()).rejects.toMatchObject({
      status: 418,
      message: 'Yêu cầu không thành công.',
    });
  });
});

describe('app/admin/price-multipliers/api', () => {
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalApiUrl !== undefined) {
      process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    } else {
      delete process.env.NEXT_PUBLIC_API_URL;
    }
  });

  it('exports expected constants and MultiplierApiError', () => {
    expect(MULTIPLIER_MIN).toBe(1);
    expect(MULTIPLIER_MAX).toBe(10);
    expect(MAX_VALUES_PER_FIELD).toBe(20);
    expect(MSG03).toBeTruthy();
    expect(MSG_CREATE_SUCCESS).toBeTruthy();
    expect(MSG_DELETE_SUCCESS).toBeTruthy();
    expect(MSG_MAX_VALUES).toBeTruthy();
    expect(MSG_SAVE_FAILED).toBeTruthy();
    expect(MSG_LOAD_FAILED).toBeTruthy();
    expect(msg02('Multiplier')).toBe('The Multiplier field is required.');

    const defaultErr = new MultiplierApiError('bad', 400);
    expect(defaultErr.errors).toEqual([]);
    const withErrors = new MultiplierApiError('bad', 422, [
      { field: 'multiplier', message: 'Invalid' },
    ]);
    expect(withErrors.errors).toHaveLength(1);
  });

  describe('validateMultiplierInput', () => {
    it('rejects empty or whitespace input', () => {
      expect(validateMultiplierInput('', [])).toEqual({
        error: 'The Multiplier field is required.',
      });
      expect(validateMultiplierInput('   ', [1.2])).toEqual({
        error: 'The Multiplier field is required.',
      });
    });

    it('rejects malformed decimal strings and out-of-range numbers', () => {
      for (const bad of ['abc', '-1', '1.', '.5', '1.234', '1e2', '0', '0.99', '10.01', '11', '9'.repeat(400)]) {
        expect(validateMultiplierInput(bad, [])).toEqual({
          error: MSG_INVALID_MULTIPLIER,
        });
      }
    });

    it('rejects duplicates unless matching ignoreValue', () => {
      expect(validateMultiplierInput('1.5', [1.2, 1.5])).toEqual({
        error: MSG_DUPLICATE_MULTIPLIER,
      });
      expect(validateMultiplierInput('1.50', [1.2, 1.5], 1.5)).toEqual({
        value: 1.5,
      });
      expect(validateMultiplierInput('1.2', [1.2, 1.5], 1.5)).toEqual({
        error: MSG_DUPLICATE_MULTIPLIER,
      });
    });

    it('accepts valid boundary values and trims whitespace', () => {
      expect(validateMultiplierInput('1', [])).toEqual({ value: 1 });
      expect(validateMultiplierInput('10.00', [])).toEqual({ value: 10 });
      expect(validateMultiplierInput(' 1.25 ', [1.5])).toEqual({ value: 1.25 });
    });
  });

  it('fetchPriceFields omits Content-Type and includes auth header when token exists', async () => {
    localStorage.setItem('cinema_access_token', 'pm-token');
    process.env.NEXT_PUBLIC_API_URL = 'https://pm.example.com';
    const fields = [
      { group: 'SEAT', fieldKey: 'VIP', label: 'Ghế VIP', values: [] },
    ];
    fetchMock.mockResolvedValueOnce(jsonResponse(fields));

    const res = await fetchPriceFields();
    expect(res).toEqual(fields);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://pm.example.com/price-multipliers',
      expect.objectContaining({
        headers: { Authorization: 'Bearer pm-token' },
      }),
    );
  });

  it('createPriceValue, updatePriceValue, and deletePriceValue encode path params and set Content-Type only when body present', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('no storage');
    });
    const mutation = {
      message: MSG_CREATE_SUCCESS,
      value: { ruleId: 'r/1', multiplier: 1.5, updatedAt: '2026-01-01' },
      field: { group: 'SEAT', fieldKey: 'VIP 1', label: 'VIP', values: [] },
    };

    fetchMock.mockResolvedValueOnce(jsonResponse(mutation));
    await createPriceValue('SEAT', 'VIP 1', { multiplier: 1.5 });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:8010/price-multipliers/SEAT/VIP%201/values',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ multiplier: 1.5 }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    fetchMock.mockResolvedValueOnce(jsonResponse(mutation));
    await updatePriceValue('DAY', 'WEEKEND', 'r/1', { multiplier: 1.8 });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:8010/price-multipliers/DAY/WEEKEND/values/r%2F1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ multiplier: 1.8 }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    fetchMock.mockResolvedValueOnce(jsonResponse(mutation));
    await deletePriceValue('DAY', 'HOLIDAY', 'r 2');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:8010/price-multipliers/DAY/HOLIDAY/values/r%202',
      expect.objectContaining({
        method: 'DELETE',
        headers: {},
      }),
    );
  });

  it('parses error message formats and filters valid FieldErrors on non-ok responses', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          message: ['Bad A', 'Bad B'],
          errors: [
            { field: 'multiplier', message: 'Too low' },
            { field: 'group', message: 'Invalid group' },
            { field: 'fieldKey', message: 'Invalid key' },
            { field: 'unknownField', message: 'Ignored' },
            { field: 'multiplier', message: 123 },
            null,
            'str',
          ],
        },
        400,
      ),
    );

    try {
      await fetchPriceFields();
      expect.fail('Should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MultiplierApiError);
      const apiErr = err as MultiplierApiError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.message).toBe('Bad A, Bad B');
      expect(apiErr.errors).toEqual([
        { field: 'multiplier', message: 'Too low' },
        { field: 'group', message: 'Invalid group' },
        { field: 'fieldKey', message: 'Invalid key' },
      ]);
    }

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'Duplicate value', errors: 'not-array' }, 409),
    );
    await expect(fetchPriceFields()).rejects.toMatchObject({
      status: 409,
      message: 'Duplicate value',
      errors: [],
    });

    fetchMock.mockResolvedValueOnce(new Response('invalid-json', { status: 500 }));
    await expect(fetchPriceFields()).rejects.toMatchObject({
      status: 500,
      message: 'Request failed.',
      errors: [],
    });
  });
});
