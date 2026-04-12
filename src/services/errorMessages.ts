export type ErrorCategory =
  | 'rate_limit'
  | 'server_error'
  | 'not_found'
  | 'validation'
  | 'network'
  | 'timeout'
  | 'unknown';

const ERROR_MESSAGES: Record<ErrorCategory, string> = {
  rate_limit: 'Rate limit reached — retrying shortly',
  server_error: 'Data unavailable — provider error',
  not_found: 'Data series not found',
  validation: 'Unexpected data format',
  network: 'Network error — check connection',
  timeout: 'Request timed out',
  unknown: 'Failed to load data',
};

export function httpStatusToCategory(status: number): ErrorCategory {
  if (status === 429) return 'rate_limit';
  if (status === 404) return 'not_found';
  if (status >= 500) return 'server_error';
  return 'unknown';
}

export function toUserMessage(category: ErrorCategory): string {
  return ERROR_MESSAGES[category];
}

export class RateLimitError extends Error {
  name = 'RateLimitError';
  constructor(message = ERROR_MESSAGES.rate_limit) {
    super(message);
  }
}

export class HttpError extends Error {
  name = 'HttpError';
  constructor(public status: number, message?: string) {
    super(message ?? ERROR_MESSAGES[httpStatusToCategory(status)]);
  }
}

export class ValidationError extends Error {
  name = 'ValidationError';
  constructor(message = ERROR_MESSAGES.validation) {
    super(message);
  }
}
