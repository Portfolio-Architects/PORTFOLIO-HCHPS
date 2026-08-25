interface BlockItemLike {
  content?: unknown;
  children?: unknown;
}

function extractBlocksToChunks(blocks: unknown[], chunks: string[]): void {
  if (!blocks || !Array.isArray(blocks)) return;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] as BlockItemLike | undefined;
    if (!block) continue;
    if (block.content) {
      if (typeof block.content === 'string') {
        chunks.push(block.content, '\n');
      } else if (Array.isArray(block.content)) {
        for (let j = 0; j < block.content.length; j++) {
          const inline = block.content[j] as { type?: string; text?: string } | string | undefined;
          if (typeof inline === 'string') {
            chunks.push(inline);
          } else if (inline && typeof inline === 'object') {
            if (inline.type === 'text' && typeof inline.text === 'string') {
              chunks.push(inline.text);
            } else if (typeof (inline as { text?: string }).text === 'string') {
              chunks.push((inline as { text: string }).text);
            }
          }
        }
        chunks.push('\n');
      }
    }
    if (block.children && Array.isArray(block.children)) {
      extractBlocksToChunks(block.children, chunks);
    }
  }
}

export function extractRawTextFromBlocks(blocks: unknown[] | undefined | null): string {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) return '';
  const chunks: string[] = [];
  extractBlocksToChunks(blocks, chunks);
  return chunks.join('');
}

export interface ExtractedContact {
  phones: string[];
  emails: string[];
}

const PHONE_REGEX = /(01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}|02[-.\s]?\d{3,4}[-.\s]?\d{4}|0[3-9]\d[-.\s]?\d{3,4}[-.\s]?\d{4})/g;
const EMAIL_REGEX = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

export function parseContacts(text: string): ExtractedContact {
  if (!text) return { phones: [], emails: [] };
  
  PHONE_REGEX.lastIndex = 0;
  EMAIL_REGEX.lastIndex = 0;
  
  const phonesSet = new Set<string>();
  const emailsSet = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = PHONE_REGEX.exec(text)) !== null) {
    phonesSet.add(match[0]);
  }
  while ((match = EMAIL_REGEX.exec(text)) !== null) {
    emailsSet.add(match[0]);
  }

  return {
    phones: Array.from(phonesSet),
    emails: Array.from(emailsSet)
  };
}
