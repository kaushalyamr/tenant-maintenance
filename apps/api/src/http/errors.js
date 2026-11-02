export class AppError extends Error {
  constructor(message, { status = 400, code = 'bad_request', details = undefined } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }
}

export class ValidationError extends AppError {
  constructor(message, details) {
    super(message, { status: 400, code: 'validation_failed', details });
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Sign in to continue.') {
    super(message, { status: 401, code: 'unauthorized' });
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Your role is not allowed to do this.') {
    super(message, { status: 403, code: 'forbidden' });
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'That record does not exist.') {
    super(message, { status: 404, code: 'not_found' });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message, details) {
    super(message, { status: 409, code: 'conflict', details });
    this.name = 'ConflictError';
  }
}

export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

function translate(unknown) {
  if (unknown instanceof AppError) return unknown;

  if (unknown?.name === 'ZodError') {
    return new ValidationError(
      'Some of the details you sent are not valid.',
      unknown.issues.map((issue) => ({ field: issue.path.join('.') || 'body', message: issue.message })),
    );
  }
  if (unknown?.name === 'MongoServerError' && unknown.code === 11000) {
    return new ConflictError('That record already exists.', { keys: Object.keys(unknown.keyValue ?? {}) });
  }
  if (unknown?.name === 'MongoValidationError') {
    return new ValidationError('Some of the details you sent are not valid.', {
      fields: Object.keys(unknown.errors ?? {}),
    });
  }
  if (unknown?.name === 'CastError') {
    return new ValidationError(`'${unknown.value}' is not a valid identifier.`);
  }
  if (unknown?.type === 'entity.too.large') {
    return new ValidationError('That submission is too large.');
  }
  if (unknown?.code === 'LIMIT_FILE_SIZE') {
    return new ValidationError('That photo or video is too large for this service.');
  }
  if (unknown?.code === 'LIMIT_UNEXPECTED_FILE') {
    return new ValidationError('Upload exactly one photo or video in the `evidence` field.');
  }

  return Object.assign(new Error('Something went wrong on our side. Please try again.'), {
    name: 'UnexpectedError',
    status: 500,
    code: 'internal_error',
    expose: true,
    cause: unknown,
  });
}

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity.
export function errorMiddleware(err, req, res, next) {
  const error = translate(err);
  if (error.status >= 500) console.error(`${req.method} ${req.originalUrl} failed`, error.cause ?? error);
  else console.warn(`${req.method} ${req.originalUrl} -> ${error.status} ${error.code}`);

  res
    .status(error.status)
    .json({ error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) });
}
