import { google } from 'googleapis';
import { getGoogleClient } from './auth';

/**
 * Send an email via Gmail API.
 */
export async function sendEmail(
  accessToken: string,
  refreshToken: string,
  options: {
    to: string[];
    cc?: string[];
    subject: string;
    bodyHtml?: string;
    bodyText?: string;
    inReplyTo?: string;
    threadId?: string;
  }
) {
  const auth = getGoogleClient(accessToken, refreshToken);
  const gmail = google.gmail({ version: 'v1', auth });

  const headers = [
    `To: ${options.to.join(', ')}`,
    options.cc?.length ? `Cc: ${options.cc.join(', ')}` : null,
    `Subject: ${options.subject}`,
    options.inReplyTo ? `In-Reply-To: ${options.inReplyTo}` : null,
    options.inReplyTo ? `References: ${options.inReplyTo}` : null,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
  ].filter(Boolean).join('\r\n');

  const body = options.bodyHtml ?? options.bodyText ?? '';
  const rawMessage = `${headers}\r\n\r\n${body}`;
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any = {
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      threadId: options.threadId || undefined,
    },
  };

  const res = await gmail.users.messages.send(params);
  return { messageId: res.data.id, threadId: res.data.threadId };
}

/**
 * Create a draft in Gmail.
 */
export async function createDraft(
  accessToken: string,
  refreshToken: string,
  options: {
    to: string[];
    cc?: string[];
    subject: string;
    bodyHtml?: string;
    bodyText?: string;
    inReplyTo?: string;
    threadId?: string;
  }
) {
  const auth = getGoogleClient(accessToken, refreshToken);
  const gmail = google.gmail({ version: 'v1', auth });

  const headers = [
    `To: ${options.to.join(', ')}`,
    options.cc?.length ? `Cc: ${options.cc.join(', ')}` : null,
    `Subject: ${options.subject}`,
    options.inReplyTo ? `In-Reply-To: ${options.inReplyTo}` : null,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
  ].filter(Boolean).join('\r\n');

  const body = options.bodyHtml ?? options.bodyText ?? '';
  const rawMessage = `${headers}\r\n\r\n${body}`;
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw: encodedMessage,
        threadId: options.threadId || undefined,
      },
    },
  });

  return { draftId: res.data.id, messageId: res.data.message?.id };
}

/**
 * Archive a Gmail message (remove INBOX label).
 */
export async function archiveMessage(
  accessToken: string,
  refreshToken: string,
  messageId: string
) {
  const auth = getGoogleClient(accessToken, refreshToken);
  const gmail = google.gmail({ version: 'v1', auth });

  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      removeLabelIds: ['INBOX'],
    },
  });

  return { archived: true };
}

/**
 * Modify labels on a Gmail message.
 */
export async function modifyLabels(
  accessToken: string,
  refreshToken: string,
  messageId: string,
  options: { addLabelIds?: string[]; removeLabelIds?: string[] }
) {
  const auth = getGoogleClient(accessToken, refreshToken);
  const gmail = google.gmail({ version: 'v1', auth });

  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds: options.addLabelIds,
      removeLabelIds: options.removeLabelIds,
    },
  });

  return { modified: true };
}

/**
 * List Gmail labels.
 */
export async function listLabels(
  accessToken: string,
  refreshToken: string
) {
  const auth = getGoogleClient(accessToken, refreshToken);
  const gmail = google.gmail({ version: 'v1', auth });

  const res = await gmail.users.labels.list({ userId: 'me' });
  return res.data.labels ?? [];
}
