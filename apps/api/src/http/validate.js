import { ValidationError } from './errors.js';

function issuesOf(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}

export function parse(schema, data, label) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(`Check ${label}: ${result.error.issues[0].message}`, issuesOf(result.error));
  }
  return result.data;
}

export const validateBody = (schema) => (req, _res, next) => {
  try {
    req.body = parse(schema, req.body ?? {}, 'the form');
    next();
  } catch (error) {
    next(error);
  }
};

export const validateQuery = (schema) => (req, _res, next) => {
  try {
    req.query = parse(schema, req.query ?? {}, 'the filters');
    next();
  } catch (error) {
    next(error);
  }
};

export const validateParams = (schema) => (req, _res, next) => {
  try {
    req.params = parse(schema, req.params ?? {}, 'the address');
    next();
  } catch (error) {
    next(error);
  }
};
