import DOMPurify from 'isomorphic-dompurify';

const sanitizeOptions = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
};

export const sanitizeText = (value: string): string =>
  DOMPurify.sanitize(value, sanitizeOptions);
