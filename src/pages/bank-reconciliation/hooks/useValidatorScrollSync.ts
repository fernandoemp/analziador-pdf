import { useRef } from 'react';

export const useValidatorScrollSync = () => {
  const pdfScrollRef = useRef<HTMLDivElement | null>(null);
  const aiScrollRef = useRef<HTMLDivElement | null>(null);

  const syncScroll = () => {
    const source = pdfScrollRef.current;
    const target = aiScrollRef.current;
    if (!source || !target) return;
    const sourceMax = source.scrollHeight - source.clientHeight || 1;
    const targetMax = target.scrollHeight - target.clientHeight || 1;
    const ratio = source.scrollTop / sourceMax;
    target.scrollTop = ratio * targetMax;
  };

  return { pdfScrollRef, aiScrollRef, syncScroll };
};
