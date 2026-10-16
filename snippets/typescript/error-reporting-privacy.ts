/**
 * Error reporting that carries the error and nothing about the person.
 *
 * Error-tracking SDKs collect user info, cookies, headers, bodies, query
 * strings and local variables by default — any of which can hold a name, an
 * email, a phone number or a session. All of it is switched off, and paths
 * that carry a credential in the URL are masked everywhere an event can
 * repeat them. Shared by the server and the browser configs.
 */
import type { NodeOptions } from '@sentry/nextjs';

export const DATA_COLLECTION: NonNullable<NodeOptions['dataCollection']> = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  stackFrameVariables: false,
  queues: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false }
};

/** Routes like /confirm/<token> and /invite/<token> carry a secret. */
const SECRET_PATH = /\/(confirm|invite)\/[^/?#\s"']+/g;

export function scrubSecretPaths(text: string | undefined): string | undefined {
  return text?.replace(SECRET_PATH, '/$1/[token]');
}

type Scrubbable = {
  request?: { url?: string };
  transaction?: string;
  message?: string;
  breadcrumbs?: { message?: string; data?: Record<string, unknown> }[];
  exception?: { values?: { value?: string }[] };
};

/** `beforeSend` for both runtimes: every token path masked. */
export function withoutSecretPaths<E extends Scrubbable>(event: E): E {
  if (event.request?.url) event.request.url = scrubSecretPaths(event.request.url);
  event.transaction = scrubSecretPaths(event.transaction);
  event.message = scrubSecretPaths(event.message);
  for (const crumb of event.breadcrumbs ?? []) {
    crumb.message = scrubSecretPaths(crumb.message);
    for (const key of ['url', 'from', 'to'] as const) {
      const value = crumb.data?.[key];
      if (typeof value === 'string') crumb.data![key] = scrubSecretPaths(value);
    }
  }
  for (const value of event.exception?.values ?? []) value.value = scrubSecretPaths(value.value);
  return event;
}
