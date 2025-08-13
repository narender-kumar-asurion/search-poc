import { Request, Response, NextFunction } from 'express';
import { apiKeyAuth } from '../../../../src/api/middleware/auth';

describe('Auth Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;

  beforeEach(() => {
    req = {
      header: jest.fn(),
    };

    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    
    res = {
      status: statusSpy,
      json: jsonSpy,
    };

    next = jest.fn();

    // Clear environment variables
    delete process.env.API_AUTH_ENABLED;
    delete process.env.API_KEY;
  });

  describe('apiKeyAuth', () => {
    describe('when authentication is disabled', () => {
      beforeEach(() => {
        process.env.API_AUTH_ENABLED = 'false';
      });

      it('should call next() without checking API key', () => {
        apiKeyAuth(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
        expect(req.header).not.toHaveBeenCalled();
        expect(statusSpy).not.toHaveBeenCalled();
      });

      it('should call next() when API_AUTH_ENABLED is not set', () => {
        delete process.env.API_AUTH_ENABLED;

        apiKeyAuth(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
        expect(statusSpy).not.toHaveBeenCalled();
      });
    });

    describe('when authentication is enabled', () => {
      beforeEach(() => {
        process.env.API_AUTH_ENABLED = 'true';
      });

      describe('server configuration errors', () => {
        it('should return 500 when API_KEY is not configured', () => {
          delete process.env.API_KEY;

          apiKeyAuth(req as Request, res as Response, next);

          expect(statusSpy).toHaveBeenCalledWith(500);
          expect(jsonSpy).toHaveBeenCalledWith({
            success: false,
            error: 'Server misconfigured: API_KEY missing',
          });
          expect(next).not.toHaveBeenCalled();
        });

        it('should return 500 when API_KEY is empty string', () => {
          process.env.API_KEY = '';

          apiKeyAuth(req as Request, res as Response, next);

          expect(statusSpy).toHaveBeenCalledWith(500);
          expect(jsonSpy).toHaveBeenCalledWith({
            success: false,
            error: 'Server misconfigured: API_KEY missing',
          });
          expect(next).not.toHaveBeenCalled();
        });
      });

      describe('valid configuration', () => {
        beforeEach(() => {
          process.env.API_KEY = 'valid-api-key-12345';
        });

        it('should return 401 when no API key is provided', () => {
          (req.header as jest.Mock).mockReturnValue(undefined);

          apiKeyAuth(req as Request, res as Response, next);

          expect(req.header).toHaveBeenCalledWith('x-api-key');
          expect(statusSpy).toHaveBeenCalledWith(401);
          expect(jsonSpy).toHaveBeenCalledWith({
            success: false,
            error: 'Unauthorized',
          });
          expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when empty API key is provided', () => {
          (req.header as jest.Mock).mockReturnValue('');

          apiKeyAuth(req as Request, res as Response, next);

          expect(statusSpy).toHaveBeenCalledWith(401);
          expect(jsonSpy).toHaveBeenCalledWith({
            success: false,
            error: 'Unauthorized',
          });
          expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when incorrect API key is provided', () => {
          (req.header as jest.Mock).mockReturnValue('wrong-api-key');

          apiKeyAuth(req as Request, res as Response, next);

          expect(statusSpy).toHaveBeenCalledWith(401);
          expect(jsonSpy).toHaveBeenCalledWith({
            success: false,
            error: 'Unauthorized',
          });
          expect(next).not.toHaveBeenCalled();
        });

        it('should call next() when correct API key is provided', () => {
          (req.header as jest.Mock).mockReturnValue('valid-api-key-12345');

          apiKeyAuth(req as Request, res as Response, next);

          expect(req.header).toHaveBeenCalledWith('x-api-key');
          expect(next).toHaveBeenCalled();
          expect(statusSpy).not.toHaveBeenCalled();
        });

        it('should handle case-sensitive API key comparison', () => {
          (req.header as jest.Mock).mockReturnValue('VALID-API-KEY-12345');

          apiKeyAuth(req as Request, res as Response, next);

          expect(statusSpy).toHaveBeenCalledWith(401);
          expect(jsonSpy).toHaveBeenCalledWith({
            success: false,
            error: 'Unauthorized',
          });
          expect(next).not.toHaveBeenCalled();
        });

        it('should handle API key with extra whitespace', () => {
          (req.header as jest.Mock).mockReturnValue(' valid-api-key-12345 ');

          apiKeyAuth(req as Request, res as Response, next);

          expect(statusSpy).toHaveBeenCalledWith(401);
          expect(jsonSpy).toHaveBeenCalledWith({
            success: false,
            error: 'Unauthorized',
          });
          expect(next).not.toHaveBeenCalled();
        });
      });

      describe('edge cases and security considerations', () => {
        beforeEach(() => {
          process.env.API_KEY = 'secure-api-key-123';
        });

        it('should handle null API key header', () => {
          (req.header as jest.Mock).mockReturnValue(null);

          apiKeyAuth(req as Request, res as Response, next);

          expect(statusSpy).toHaveBeenCalledWith(401);
          expect(next).not.toHaveBeenCalled();
        });

        it('should handle very long API keys', () => {
          const longKey = 'a'.repeat(10000);
          process.env.API_KEY = longKey;
          (req.header as jest.Mock).mockReturnValue(longKey);

          apiKeyAuth(req as Request, res as Response, next);

          expect(next).toHaveBeenCalled();
          expect(statusSpy).not.toHaveBeenCalled();
        });

        it('should handle special characters in API key', () => {
          const specialKey = 'api-key-with-$pecial-ch@rs!';
          process.env.API_KEY = specialKey;
          (req.header as jest.Mock).mockReturnValue(specialKey);

          apiKeyAuth(req as Request, res as Response, next);

          expect(next).toHaveBeenCalled();
          expect(statusSpy).not.toHaveBeenCalled();
        });

        it('should handle Unicode characters in API key', () => {
          const unicodeKey = 'api-key-with-üñíçødé-123';
          process.env.API_KEY = unicodeKey;
          (req.header as jest.Mock).mockReturnValue(unicodeKey);

          apiKeyAuth(req as Request, res as Response, next);

          expect(next).toHaveBeenCalled();
          expect(statusSpy).not.toHaveBeenCalled();
        });

        it('should not leak information about valid API keys in error messages', () => {
          (req.header as jest.Mock).mockReturnValue('wrong-key');

          apiKeyAuth(req as Request, res as Response, next);

          expect(jsonSpy).toHaveBeenCalledWith({
            success: false,
            error: 'Unauthorized',
          });
          
          // Ensure no information about expected key is leaked
          const errorMessage = jsonSpy.mock.calls[0][0].error;
          expect(errorMessage).not.toContain('secure-api-key-123');
          expect(errorMessage).not.toContain('expected');
          expect(errorMessage).not.toContain('should be');
        });

        it('should handle multiple header calls gracefully', () => {
          (req.header as jest.Mock).mockReturnValue('secure-api-key-123');

          apiKeyAuth(req as Request, res as Response, next);

          expect(req.header).toHaveBeenCalledTimes(1);
          expect(req.header).toHaveBeenCalledWith('x-api-key');
          expect(next).toHaveBeenCalled();
        });
      });

      describe('environment variable edge cases', () => {
        it('should handle API_AUTH_ENABLED with different case', () => {
          process.env.API_AUTH_ENABLED = 'TRUE';
          process.env.API_KEY = 'test-key';

          apiKeyAuth(req as Request, res as Response, next);

          // Should not be case insensitive - only 'true' should enable auth
          expect(next).toHaveBeenCalled();
          expect(statusSpy).not.toHaveBeenCalled();
        });

        it('should handle API_AUTH_ENABLED with extra whitespace', () => {
          process.env.API_AUTH_ENABLED = ' true ';
          process.env.API_KEY = 'test-key';

          apiKeyAuth(req as Request, res as Response, next);

          // Should not trim whitespace - only exact 'true' should enable auth
          expect(next).toHaveBeenCalled();
          expect(statusSpy).not.toHaveBeenCalled();
        });

        it('should handle API_AUTH_ENABLED set to "1"', () => {
          process.env.API_AUTH_ENABLED = '1';
          process.env.API_KEY = 'test-key';

          apiKeyAuth(req as Request, res as Response, next);

          // Only 'true' should enable auth, not '1'
          expect(next).toHaveBeenCalled();
          expect(statusSpy).not.toHaveBeenCalled();
        });
      });

      describe('response format consistency', () => {
        beforeEach(() => {
          process.env.API_KEY = 'test-key';
        });

        it('should return consistent response structure for 401 errors', () => {
          (req.header as jest.Mock).mockReturnValue('wrong-key');

          apiKeyAuth(req as Request, res as Response, next);

          expect(jsonSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              success: false,
              error: expect.any(String),
            })
          );

          const response = jsonSpy.mock.calls[0][0];
          expect(Object.keys(response)).toEqual(['success', 'error']);
        });

        it('should return consistent response structure for 500 errors', () => {
          delete process.env.API_KEY;

          apiKeyAuth(req as Request, res as Response, next);

          expect(jsonSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              success: false,
              error: expect.any(String),
            })
          );

          const response = jsonSpy.mock.calls[0][0];
          expect(Object.keys(response)).toEqual(['success', 'error']);
        });
      });
    });

    describe('integration with Express request flow', () => {
      it('should preserve request and response objects', () => {
        process.env.API_AUTH_ENABLED = 'true';
        process.env.API_KEY = 'test-key';
        (req.header as jest.Mock).mockReturnValue('test-key');

        const originalReq = req;
        const originalRes = res;

        apiKeyAuth(req as Request, res as Response, next);

        expect(req).toBe(originalReq);
        expect(res).toBe(originalRes);
        expect(next).toHaveBeenCalledWith(); // Called with no arguments
      });

      it('should not modify request or response objects', () => {
        process.env.API_AUTH_ENABLED = 'true';
        process.env.API_KEY = 'test-key';
        (req.header as jest.Mock).mockReturnValue('test-key');

        const reqKeys = Object.keys(req);
        const resKeys = Object.keys(res);

        apiKeyAuth(req as Request, res as Response, next);

        expect(Object.keys(req)).toEqual(reqKeys);
        expect(Object.keys(res)).toEqual(resKeys);
      });
    });
  });
});
