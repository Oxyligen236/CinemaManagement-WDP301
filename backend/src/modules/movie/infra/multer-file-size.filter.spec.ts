import { ArgumentsHost, HttpStatus, PayloadTooLargeException } from '@nestjs/common';
import { MSG09 } from '../domain/constants/movie-asset.constants';
import { MulterFileSizeExceptionFilter } from './multer-file-size.filter';

describe('MulterFileSizeExceptionFilter', () => {
  it('converts PayloadTooLargeException into 400 Bad Request with MSG09', () => {
    const filter = new MulterFileSizeExceptionFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;

    filter.catch(new PayloadTooLargeException(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: MSG09,
      error: 'Bad Request',
    });
  });
});
