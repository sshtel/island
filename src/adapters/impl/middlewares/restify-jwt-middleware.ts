import jwt = require('jsonwebtoken');
import restify = require('restify');

export interface IToken {
  sid: string;
  aid?: string;
  aname?: string;
  publisher: string;
}

/**
 * Check the HTTP authorization header, then parse only if the header is a bearer JWT token.
 * @param {{secret: string}} options
 * @return {RequestHandler}
 */
export default function jwtParser(options: { secret: string }): restify.RequestHandler {
  return (req: restify.Request, res: restify.Response, next: restify.Next) => {
    /**
     * Authorization field of the request header examples
     *
     *  GET /auth/ HTTP/1.1
     *  Host: www.example.com
     *  Authorization: Basic aHR0cHdhdGNoOmY=
     */
    const header: string = (req.headers.authorization) as string;
    if (!header) return next();

    const parts = header.split(' ');
    if (!parts || parts.length !== 2) {
      console.log('[RESTIFY] invalid auth header', parts);
      return next(new restify.InvalidHeaderError('Invalid Authorization header'));
    }

    const scheme = parts[0];
    const credentials = parts[1];
    if (/^Bearer$/i.test(scheme)) {
      jwt.verify(credentials, options.secret, (err, decode) => {
        if (err) return next();
        (req as any).token = typeof decode === 'string' ? JSON.parse(decode) : decode;
        next();
      });
    } else {
      next();
    }
  };
}
