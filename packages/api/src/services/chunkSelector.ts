import { chunkText } from './chunker.js';

interface ScoredChunk {
  chunk: string;
  index: number;
  score: number;
}

/**
 * Scores a chunk based on informational richness, structure, and keyword density.
 */
function scoreChunk(chunk: string): number {
  let score = 0;

  // Headings and section indicators (+15 per heading)
  const headingMatches = chunk.match(/(?:^|\n)(?:#{1,6}\s+|[A-Z0-9.\-_]{2,}:|\d+\.\s+[A-Z])/g);
  if (headingMatches) {
    score += headingMatches.length * 15;
  }

  // Question / key concept markers (+10)
  const conceptMatches = chunk.match(/\b(?:definition|principle|overview|architecture|framework|function|purpose|method|result|conclusion)\b/gi);
  if (conceptMatches) {
    score += conceptMatches.length * 10;
  }

  // Count unique substantive vocabulary (length >= 4)
  const words = chunk.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const uniqueWords = new Set(words);
  score += Math.min(uniqueWords.size, 150);

  // Length factor: reward well-filled chunks (up to 50 points)
  score += Math.min(chunk.length / 240, 50);

  return score;
}

/**
 * For long documents, selects the most relevant, representative chunks rather than sending the entire payload.
 * Guarantees cross-document distribution (introductory, core body, and concluding parts).
 */
export function selectRelevantChunks(text: string, maxChars: number = 25000): string {
  if (text.length <= maxChars) {
    return text;
  }

  const chunks = chunkText(text, 12000);
  if (chunks.length <= 2) {
    return text.slice(0, maxChars);
  }

  // Score all chunks
  const scoredChunks: ScoredChunk[] = chunks.map((chunk, index) => ({
    chunk,
    index,
    score: scoreChunk(chunk),
  }));

  // Divide document chunks into 3 zones: Beginning, Middle, Ending
  const oneThird = Math.max(1, Math.floor(chunks.length / 3));
  const zone1 = scoredChunks.slice(0, oneThird);
  const zone2 = scoredChunks.slice(oneThird, chunks.length - oneThird);
  const zone3 = scoredChunks.slice(chunks.length - oneThird);

  const getBestInZone = (zone: ScoredChunk[]) =>
    zone.length ? [...zone].sort((a, b) => b.score - a.score)[0] : null;

  const chosen: ScoredChunk[] = [];
  const best1 = getBestInZone(zone1);
  const best2 = getBestInZone(zone2);
  const best3 = getBestInZone(zone3);

  if (best1) chosen.push(best1);
  if (best2 && !chosen.some((c) => c.index === best2.index)) chosen.push(best2);
  if (best3 && !chosen.some((c) => c.index === best3.index)) chosen.push(best3);

  // If we still have capacity, pick next highest scored chunks overall
  const sortedRemaining = [...scoredChunks]
    .filter((c) => !chosen.some((x) => x.index === c.index))
    .sort((a, b) => b.score - a.score);

  for (const extra of sortedRemaining) {
    const currentLength = chosen.reduce((acc, c) => acc + c.chunk.length, 0);
    if (currentLength + extra.chunk.length <= maxChars) {
      chosen.push(extra);
    }
  }

  // Sort chosen chunks in their original chronological order
  chosen.sort((a, b) => a.index - b.index);

  return chosen.map((c) => c.chunk).join('\n\n--- [Section Break] ---\n\n');
}
