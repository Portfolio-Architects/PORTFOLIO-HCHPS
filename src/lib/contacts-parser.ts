export function extractRawTextFromBlocks(blocks: any[]): string {
  let text = "";
  if (!blocks) return text;
  for (const block of blocks) {
    if (block.content) {
      if (typeof block.content === 'string') {
        text += block.content + "\n";
      } else if (Array.isArray(block.content)) {
        for (const inline of block.content) {
          if (inline && inline.type === 'text' && typeof inline.text === 'string') {
            text += inline.text;
          }
        }
        text += "\n";
      }
    }
    if (block.children && Array.isArray(block.children)) {
      text += extractRawTextFromBlocks(block.children);
    }
  }
  return text;
}

export interface ExtractedContact {
  phones: string[];
  emails: string[];
}

export function parseContacts(text: string): ExtractedContact {
  // 010-XXXX-XXXX, 02-XXX-XXXX, 031-XXXX-XXXX 등 다양한 유무선 전화번호 포맷 지원
  const phoneRegex = /(01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}|02[-.\s]?\d{3,4}[-.\s]?\d{4}|0[3-9]\d[-.\s]?\d{3,4}[-.\s]?\d{4})/g;
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

  const phones = Array.from(new Set(text.match(phoneRegex) || []));
  const emails = Array.from(new Set(text.match(emailRegex) || []));

  return { phones, emails };
}
