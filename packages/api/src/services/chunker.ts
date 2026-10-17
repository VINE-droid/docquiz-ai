/**
 * Utility functions for counting words and splitting text into chunks of ~12,000 characters
 * breaking at paragraph or sentence boundaries.
 */

export function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

export function countChars(text: string): number {
  return text.length;
}

/**
 * Splits text into chunks of approximately `targetSize` characters (default 12,000),
 * prioritizing paragraph breaks first, then sentence breaks, then word breaks.
 */
export function chunkText(text: string, targetSize: number = 12000): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  if (normalized.length <= targetSize) {
    return [normalized];
  }

  // 1. Break into paragraphs
  const rawParagraphs = normalized.split(/\n\s*\n/);
  const segments: string[] = [];

  for (const paragraph of rawParagraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;

    if (trimmedParagraph.length <= targetSize) {
      segments.push(trimmedParagraph);
    } else {
      // Paragraph exceeds targetSize; split into sentences.
      // Match sentence boundaries (ending with ., !, ? followed by space or newline)
      const sentenceRegex = /[^.!?\n]+(?:[.!?]+(?:\s+|$)|$)/g;
      const sentences = trimmedParagraph.match(sentenceRegex) || [trimmedParagraph];

      for (const rawSentence of sentences) {
        const trimmedSentence = rawSentence.trim();
        if (!trimmedSentence) continue;

        if (trimmedSentence.length <= targetSize) {
          segments.push(trimmedSentence);
        } else {
          // A single sentence exceeds targetSize; split by words
          const words = trimmedSentence.split(/\s+/);
          let currentWordChunk = '';

          for (const word of words) {
            if ((currentWordChunk ? `${currentWordChunk} ${word}` : word).length <= targetSize) {
              currentWordChunk = currentWordChunk ? `${currentWordChunk} ${word}` : word;
            } else {
              if (currentWordChunk) {
                segments.push(currentWordChunk);
                currentWordChunk = '';
              }

              if (word.length <= targetSize) {
                currentWordChunk = word;
              } else {
                // Extremely long word/token without spaces; slice directly
                for (let i = 0; i < word.length; i += targetSize) {
                  segments.push(word.slice(i, i + targetSize));
                }
              }
            }
          }

          if (currentWordChunk) {
            segments.push(currentWordChunk);
          }
        }
      }
    }
  }

  // 2. Assemble atomic segments into chunks close to targetSize
  const chunks: string[] = [];
  let currentChunk = '';

  for (const segment of segments) {
    if (!currentChunk) {
      currentChunk = segment;
      continue;
    }

    // Delimit paragraphs/segments with double newline
    const combinedLength = currentChunk.length + 2 + segment.length;
    if (combinedLength <= targetSize) {
      currentChunk = `${currentChunk}\n\n${segment}`;
    } else {
      chunks.push(currentChunk);
      currentChunk = segment;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}
