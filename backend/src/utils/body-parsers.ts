import express, { NextFunction, Request, Response } from 'express';

// POST /api/tx takes the transaction hex as the whole body, whatever its content type, as electrs's POST /tx
// does. index.ts's parsers read a text/plain body as text, and a form, which `curl -d <hex>` sends, as an object
// whose sole key is the hex. This reads a body of any other type as text, and turns that form back into the hex.
export const rawTransactionBody = [
  express.text({ type: () => true, limit: '10mb' }),
  (req: Request, res: Response, next: NextFunction): void => {
    if (req.is('application/x-www-form-urlencoded') && req.body && typeof req.body === 'object') {
      const keys = Object.keys(req.body);
      if (keys.length === 1 && req.body[keys[0]] === '') {
        req.body = keys[0];
      }
    }
    next();
  },
];
