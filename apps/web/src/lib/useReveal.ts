import { useEffect, useRef, useState } from 'react';

export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const revealClass = `transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${
    visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
  }`;

  return { ref, revealClass };
}
