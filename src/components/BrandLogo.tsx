import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export const BRAND_NAME = "tailorfeed";
export const BRAND_MOTTO = "Your financial news feed. Tailor made.";

export interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  showMotto?: boolean;
  mottoPlacement?: "inline" | "stacked";
  asLink?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: {
    logo: "h-6 w-auto",
    title: "text-lg",
    gap: "gap-2",
  },
  md: {
    logo: "h-7 w-auto",
    title: "text-xl",
    gap: "gap-2.5",
  },
  lg: {
    logo: "h-20 sm:h-24 w-auto",
    title: "text-3xl",
    gap: "gap-3",
  },
} as const;

export default function BrandLogo({
  size = "sm",
  showMotto = false,
  mottoPlacement = "inline",
  asLink = true,
  className,
}: BrandLogoProps) {
  const currentSize = SIZE_CLASSES[size];
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`;

  if (mottoPlacement === "stacked") {
    const content = (
      <div className={cn("flex flex-col items-center text-center", className)}>
        <img
          src={logoSrc}
          alt={`${BRAND_NAME} logo`}
          className={cn(
            "object-contain select-none shrink-0 mx-auto mb-3.5 invert dark:invert-0",
            currentSize.logo
          )}
        />
        <span
          className={cn(
            "font-display font-bold tracking-tight lowercase text-foreground",
            currentSize.title
          )}
        >
          {BRAND_NAME}
        </span>
        {showMotto && (
          <p className="text-muted-foreground font-body text-sm mt-1.5">
            {BRAND_MOTTO}
          </p>
        )}
      </div>
    );

    return asLink ? (
      <Link to="/" className="inline-block focus:outline-none">
        {content}
      </Link>
    ) : (
      content
    );
  }

  const brandMark = (
    <div className={cn("inline-flex items-center", currentSize.gap)}>
      <img
        src={logoSrc}
        alt={`${BRAND_NAME} logo`}
        className={cn(
          "object-contain select-none shrink-0 invert dark:invert-0",
          currentSize.logo
        )}
      />
      <span
        className={cn(
          "font-display font-bold tracking-tight lowercase text-foreground",
          currentSize.title
        )}
      >
        {BRAND_NAME}
      </span>
    </div>
  );

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {asLink ? (
        <Link
          to="/"
          className="inline-flex items-center focus:outline-none hover:opacity-90 transition-opacity"
        >
          {brandMark}
        </Link>
      ) : (
        brandMark
      )}
      {showMotto && (
        <span className="hidden xl:inline-block text-xs font-normal text-muted-foreground border-l border-border pl-2.5 ml-1">
          {BRAND_MOTTO}
        </span>
      )}
    </div>
  );
}
