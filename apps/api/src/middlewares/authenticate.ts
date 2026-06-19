import { Request, Response, NextFunction } from 'express';

// M1 MVP AUTH - Practice File

export function authenticate(req: Request, res: Response, next: NextFunction) {
  // TODO: 4.1 The Authenticate Middleware
  // 1. Grab token from cookie or header
  // 2. Verify JWT signature
  // 3. Attach decoded payload to req.user
  // 4. Call next()
}

