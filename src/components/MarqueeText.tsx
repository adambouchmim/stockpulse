import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MarqueeTextProps {
  text: string;
  className?: string;
  containerClassName?: string;
  delayMs?: number;
}

export function MarqueeText({
  text,
  className = "",
  containerClassName = "",
  delayMs = 0,
}: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const diff = textRef.current.scrollWidth - containerRef.current.clientWidth;
        setOverflow(diff > 4 ? diff : 0);
      }
    };

    checkOverflow();

    window.addEventListener("resize", checkOverflow);
    if (document.fonts?.ready) {
      document.fonts.ready.then(checkOverflow);
    }

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      observer = new ResizeObserver(checkOverflow);
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", checkOverflow);
      observer?.disconnect();
    };
  }, [text]);

  const duration = Math.max(7, Math.min(14, 5 + overflow / 20));

  const maskStyles =
    overflow > 0
      ? {
          WebkitMaskImage:
            "linear-gradient(to right, black calc(100% - 16px), transparent 100%)",
          maskImage:
            "linear-gradient(to right, black calc(100% - 16px), transparent 100%)",
        }
      : undefined;

  return (
    <div
      ref={containerRef}
      className={cn("overflow-hidden relative max-w-full", containerClassName)}
      style={maskStyles}
      title={text}
    >
      <span
        ref={textRef}
        className={`inline-block whitespace-nowrap ${
          overflow > 0
            ? "animate-marquee-ping-pong hover:[animation-play-state:paused]"
            : "truncate w-full"
        } ${className}`}
        style={
          overflow > 0
            ? ({
                "--marquee-distance": `-${overflow + 8}px`,
                animationDuration: `${duration}s`,
                animationDelay: `${delayMs}ms`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
}
