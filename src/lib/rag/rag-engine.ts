import { promises as fs } from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Types
export interface WikiChunk {
  text: string;
  vector?: number[];
}

export interface WikiEmbeddingDoc {
  nodeId: string;
  nodeLabel: string;
  lastUpdated: number;
  chunks: WikiChunk[];
}

export interface SearchResult {
  nodeId: string;
  nodeLabel: string;
  chunk: string;
  semanticScore: number;
  keywordScore: number;
  score: number;
}

const EMBEDDINGS_FILE_PATH = path.join(process.cwd(), 'data', 'WIKI_EMBEDDINGS.json');

export class RAGEngine {
  private static apiKey = process.env.GOOGLE_GEMINI_API_KEY || '';

  // 1. Windows file-lock collision safe reading
  private static async safeReadFile(filePath: string, retries = 5, delay = 50): Promise<string> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fs.readFile(filePath, 'utf-8');
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          return '{}';
        }
        if (attempt === retries) throw err;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error(`Failed to read file: ${filePath}`);
  }

  // 2. Windows file-lock collision safe writing
  private static async safeWriteFile(filePath: string, dataStr: string, retries = 5, delay = 50): Promise<void> {
    const dirPath = path.dirname(filePath);
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch {}

    const tempFilePath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await fs.writeFile(tempFilePath, dataStr, 'utf-8');
        
        let renamed = false;
        for (let renameAttempt = 1; renameAttempt <= 3; renameAttempt++) {
          try {
            await fs.rename(tempFilePath, filePath);
            renamed = true;
            break;
          } catch (renameErr) {
            if (renameAttempt === 3) throw renameErr;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        if (renamed) return;
      } catch (err: any) {
        try {
          await fs.unlink(tempFilePath);
        } catch {}

        if (attempt === retries) throw err;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // 3. Simple text chunking by paragraph, sentence, and hard size limit
  public static chunkText(text: string, maxLen = 650): string[] {
    if (!text) return [];
    
    // Split by paragraphs
    const paragraphs = text.split(/\n+/);
    const chunks: string[] = [];
    let currentChunk = '';

    const pushChunk = (chunkStr: string) => {
      const trimmed = chunkStr.trim();
      if (!trimmed) return;
      if (trimmed.length <= maxLen) {
        chunks.push(trimmed);
      } else {
        for (let i = 0; i < trimmed.length; i += maxLen) {
          const slice = trimmed.slice(i, i + maxLen).trim();
          if (slice) chunks.push(slice);
        }
      }
    };

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      if ((currentChunk + '\n' + trimmed).length > maxLen) {
        if (currentChunk) {
          pushChunk(currentChunk);
          currentChunk = '';
        }
        
        // If single paragraph is longer than maxLen, split by sentences
        if (trimmed.length > maxLen) {
          const sentences = trimmed.split(/(?<=[.?!])\s+/);
          let sentenceChunk = '';
          for (const sentence of sentences) {
            if ((sentenceChunk + ' ' + sentence).length > maxLen) {
              if (sentenceChunk) {
                pushChunk(sentenceChunk);
                sentenceChunk = '';
              }
              if (sentence.length > maxLen) {
                for (let i = 0; i < sentence.length; i += maxLen) {
                  const part = sentence.slice(i, i + maxLen);
                  if (i + maxLen < sentence.length) {
                    pushChunk(part);
                  } else {
                    sentenceChunk = part;
                  }
                }
              } else {
                sentenceChunk = sentence;
              }
            } else {
              sentenceChunk = sentenceChunk ? (sentenceChunk + ' ' + sentence) : sentence;
            }
          }
          if (sentenceChunk) {
            currentChunk = sentenceChunk;
          }
        } else {
          currentChunk = trimmed;
        }
      } else {
        currentChunk = currentChunk ? (currentChunk + '\n' + trimmed) : trimmed;
      }
    }
    
    if (currentChunk) {
      pushChunk(currentChunk);
    }

    // Final safety guarantee: forcibly split any remaining chunk > maxLen into hard slices
    const finalChunks: string[] = [];
    for (const c of chunks) {
      if (c.length <= maxLen) {
        finalChunks.push(c);
      } else {
        for (let i = 0; i < c.length; i += maxLen) {
          const slice = c.slice(i, i + maxLen).trim();
          if (slice) finalChunks.push(slice);
        }
      }
    }

    return finalChunks.filter(c => c.length > 5);
  }

  // 4. Korean NLP Bi-gram tokenizer for keyword scoring
  public static tokenize(text: string): Set<string> {
    const tokens = new Set<string>();
    if (!text) return tokens;

    // Clean special characters
    const cleanText = text.replace(/[^가-힣a-zA-Z0-9\s]/g, ' ');
    const words = cleanText.split(/\s+/).filter(w => w.length > 0);

    for (const word of words) {
      // Add word itself
      if (word.length >= 2) {
        tokens.add(word);
      }
      
      // Bi-gram tokens for partial match (Korean postposition resilience)
      for (let i = 0; i < word.length - 1; i++) {
        tokens.add(word.substring(i, i + 2));
      }
    }

    return tokens;
  }

  // 5. Compute Jaccard Similarity between query and document tokens
  public static computeKeywordScore(query: string, document: string): number {
    const queryTokens = this.tokenize(query);
    const docTokens = this.tokenize(document);

    if (queryTokens.size === 0 || docTokens.size === 0) return 0;

    let intersectionSize = 0;
    for (const qToken of queryTokens) {
      if (docTokens.has(qToken)) {
        intersectionSize++;
      }
    }

    // Keyword score = Intersection / Query size (how much of query was covered)
    return intersectionSize / queryTokens.size;
  }

  // 6. Vector Cosine Similarity
  public static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // 7. Get Embedding from Gemini
  public static async getEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is missing');
    }

    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    
    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  // 8. Extract plain text from BlockNote blocks
  private static extractBlocksToChunks(blocks: unknown[], chunks: string[]): void {
    if (!blocks || !Array.isArray(blocks)) return;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i] as { content?: unknown; children?: unknown[] };
      if (!block) continue;
      if (block.content && Array.isArray(block.content)) {
        const lineChunks: string[] = [];
        for (let j = 0; j < block.content.length; j++) {
          const c = block.content[j] as { text?: unknown };
          if (c && typeof c.text === 'string') {
            lineChunks.push(c.text);
          }
        }
        const line = lineChunks.join('');
        if (line.trim()) {
          chunks.push(line, '\n');
        }
      }
      if (block.children && Array.isArray(block.children) && block.children.length > 0) {
        this.extractBlocksToChunks(block.children, chunks);
      }
    }
  }

  private static extractTextFromBlocks(blocks: unknown[]): string {
    if (!blocks || !Array.isArray(blocks)) return '';
    const chunks: string[] = [];
    this.extractBlocksToChunks(blocks, chunks);
    return chunks.join('');
  }

  // 9. Re-index / Upsert Node Wiki to Embeddings Database
  public static async updateNodeEmbedding(nodeId: string, nodeLabel: string, blocks: unknown[]): Promise<void> {
    try {
      const fullText = this.extractTextFromBlocks(blocks);
      const chunks = this.chunkText(fullText);

      // Load existing embeddings file
      const rawFile = await this.safeReadFile(EMBEDDINGS_FILE_PATH);
      const embeddingsStore: Record<string, WikiEmbeddingDoc> = JSON.parse(rawFile);

      if (chunks.length === 0) {
        // If wiki content is deleted or empty, delete from store
        if (embeddingsStore[nodeId]) {
          delete embeddingsStore[nodeId];
          await this.safeWriteFile(EMBEDDINGS_FILE_PATH, JSON.stringify(embeddingsStore, null, 2));
        }
        return;
      }

      // Generate vectors for chunks
      const wikiChunks: WikiChunk[] = [];
      for (const chunkText of chunks) {
        let vector: number[] | undefined;
        
        // Fallback: If no API key, bypass embedding calculation
        if (this.apiKey) {
          try {
            vector = await this.getEmbedding(chunkText);
          } catch (embedErr: any) {
            console.warn(`[RAGEngine] Failed to generate embedding for chunk, using fallback keyword only:`, embedErr.message);
          }
        }
        
        wikiChunks.push({
          text: chunkText,
          vector
        });
      }

      embeddingsStore[nodeId] = {
        nodeId,
        nodeLabel,
        lastUpdated: Date.now(),
        chunks: wikiChunks
      };

      await this.safeWriteFile(EMBEDDINGS_FILE_PATH, JSON.stringify(embeddingsStore, null, 2));
      console.log(`[RAGEngine] Successfully updated RAG index for node: ${nodeLabel} (${nodeId}) with ${wikiChunks.length} chunks`);
    } catch (err: any) {
      console.error(`[RAGEngine] Error updating node embedding:`, err);
    }
  }

  // 10. Hybrid Search across all indexed wiki chunks
  public static async search(query: string, limit = 5): Promise<SearchResult[]> {
    try {
      const cleanQuery = query.trim();
      if (!cleanQuery) return [];

      let queryVector: number[] | null = null;
      if (this.apiKey) {
        try {
          queryVector = await this.getEmbedding(cleanQuery);
        } catch (err: any) {
          console.warn('[RAGEngine] Failed to embed search query, performing keyword-only fallback:', err.message);
        }
      }

      // Read indexed documents
      const rawFile = await this.safeReadFile(EMBEDDINGS_FILE_PATH);
      const embeddingsStore: Record<string, WikiEmbeddingDoc> = JSON.parse(rawFile);

      const results: SearchResult[] = [];

      for (const docId in embeddingsStore) {
        const doc = embeddingsStore[docId];
        for (const chunk of doc.chunks) {
          let semanticScore = 0;
          
          if (queryVector && chunk.vector) {
            semanticScore = this.cosineSimilarity(queryVector, chunk.vector);
          }

          const keywordScore = this.computeKeywordScore(cleanQuery, chunk.text);
          
          // Hybrid Score: 70% Semantic Vector + 30% Token overlap
          // If vector search is unavailable, use keyword score 100%
          const score = queryVector && chunk.vector 
            ? (0.7 * semanticScore + 0.3 * keywordScore)
            : keywordScore;

          results.push({
            nodeId: doc.nodeId,
            nodeLabel: doc.nodeLabel,
            chunk: chunk.text,
            semanticScore,
            keywordScore,
            score
          });
        }
      }

      // Sort by score descending and filter by threshold > 0.25
      const filtered = results
        .sort((a, b) => b.score - a.score)
        .filter(r => r.score > 0.25);

      // Intra-document chunk deduplication
      const seenChunks = new Set<string>();
      const deduplicated: SearchResult[] = [];
      for (const item of filtered) {
        const key = `${item.nodeId}:${item.chunk.trim()}`;
        if (!seenChunks.has(key)) {
          seenChunks.add(key);
          deduplicated.push(item);
        }
      }

      return deduplicated.slice(0, limit);
    } catch (err) {
      console.error('[RAGEngine] Search failed:', err);
      return [];
    }
  }
}
