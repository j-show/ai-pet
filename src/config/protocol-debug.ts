import {
  PROTOCOL_DEBUG_TRUTHY_VALUES,
  PROTOCOL_DEBUG_URL_PARAM,
  PROTOCOL_LOG_PREFIX
} from '../constants/protocol-debug';

import { envProtocolDebug, type UserEnv } from './user-env';

let protocolDebugEnabled = false;

const isTruthyParam = (raw: string | null | undefined): boolean => {
  if (!raw) {
    return false;
  }
  const value = raw.trim().toLowerCase();
  return (PROTOCOL_DEBUG_TRUTHY_VALUES as readonly string[]).includes(value);
};

const reportInitStatus = (source: string, env?: UserEnv) => {
  const raw = env?.AI_PET_DEBUG_PROTOCOL;
  const message = protocolDebugEnabled
    ? `${PROTOCOL_LOG_PREFIX} debug ON (${source})`
    : `${PROTOCOL_LOG_PREFIX} debug OFF — set AI_PET_DEBUG_PROTOCOL=true in ~/.ai-pet/.env or ?${PROTOCOL_DEBUG_URL_PARAM}=protocol`;

  console.warn(message);
  if (raw != null) {
    console.warn(
      `${PROTOCOL_LOG_PREFIX} AI_PET_DEBUG_PROTOCOL=${JSON.stringify(raw)}`
    );
  } else if (env) {
    console.warn(
      `${PROTOCOL_LOG_PREFIX} AI_PET_DEBUG_PROTOCOL not found in loaded ~/.ai-pet/.env`
    );
  }
};

/**
 * Enable protocol logging from `?debug=protocol` or `AI_PET_DEBUG_PROTOCOL` in ~/.ai-pet/.env.
 */
export const initProtocolDebug = (options: {
  urlParams?: URLSearchParams;
  env?: UserEnv;
}) => {
  if (isTruthyParam(options.urlParams?.get(PROTOCOL_DEBUG_URL_PARAM))) {
    protocolDebugEnabled = true;
    reportInitStatus(`URL ?${PROTOCOL_DEBUG_URL_PARAM}=protocol`, options.env);
    return;
  }

  if (import.meta.env.DEV && envProtocolDebug(options.env ?? {})) {
    protocolDebugEnabled = true;
    reportInitStatus('dev build + AI_PET_DEBUG_PROTOCOL', options.env);
    return;
  }

  if (envProtocolDebug(options.env ?? {})) {
    protocolDebugEnabled = true;
    reportInitStatus('~/.ai-pet/.env', options.env);
    return;
  }

  reportInitStatus('disabled', options.env);
};

export const isProtocolDebugEnabled = () => protocolDebugEnabled;

const getFormatSummary = (
  parsed:
    | { kind: 'text'; action: unknown }
    | { kind: 'command'; command: unknown }
    | { kind: 'unknown' }
) => {
  switch (parsed.kind) {
    case 'text':
      return `text ${JSON.stringify(parsed.action)}`;
    case 'command':
      return `command ${JSON.stringify(parsed.command)}`;
    default:
      return 'unknown';
  }
};

/** Log raw URL and parsed payload when debug mode is on. */
export const logProtocolReceived = (
  url: string,
  parsed:
    | { kind: 'text'; action: unknown }
    | { kind: 'command'; command: unknown }
    | { kind: 'unknown' }
) => {
  if (!protocolDebugEnabled) return;

  const summary = getFormatSummary(parsed);

  const line = `${new Date().toLocaleTimeString()} ${url} → ${summary}`;
  console.info(`${PROTOCOL_LOG_PREFIX} ${line}`);
};
