import { useCallback } from 'react';

export function useHighlightParts(keyword: string) {
  return useCallback(
    (text: string) => {
      const trimmed = keyword.trim();
      if (!trimmed) return [text];
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'ig');
      return text.split(regex);
    },
    [keyword]
  );
}
