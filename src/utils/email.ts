// Message ID generation
export const generateMessageId = () => {
  const domain = process.env.EMAIL_DOMAIN || "gmail.com";
  return `<${Date.now()}.${Math.random().toString(36).substring(2)}@${domain}>`;
};

export const normalizeMessageId = (messageId: string): string => {
  if (!messageId) return "";
  return messageId.includes("@") ? messageId : `<${messageId}@gmail.com>`;
};

// MIME and subject handling
export const encodeMIMEWords = (text: string): string => {
  if (!/^[\x00-\x7F]*$/.test(text)) {
    const encoded = Buffer.from(text, "utf-8").toString("base64");
    return `=?UTF-8?B?${encoded}?=`;
  }
  return text;
};

export const normalizeSubject = (
  subject: string,
  isReply: boolean,
  originalSubject?: string
): string => {
  const baseSubject = isReply && originalSubject ? originalSubject : subject;
  const cleanSubject = baseSubject.replace(/^(Re:\s*)+/i, "").trim();
  const finalSubject = isReply ? `Re: ${cleanSubject}` : cleanSubject;
  return encodeMIMEWords(finalSubject);
};
