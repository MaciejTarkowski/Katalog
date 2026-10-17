"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { initialOf, tileBackground } from "@/lib/items/display";

export function Icon({
  name,
  size = 22,
  fill,
  className = "",
  style,
}: {
  name: string;
  size?: number;
  fill?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span aria-hidden="true" className={`ms ${fill ? "ms-fill" : ""} ${className}`} style={{ fontSize: size, ...style }}>
      {name}
    </span>
  );
}

/** "Płyta" logo (variant C): square + record, optional wordmark. */
export function Logo({ size = 26, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <span className="inline-flex items-center text-tx leading-none" style={{ fontSize: size, gap: ".32em" }} aria-label="katalog">
      <span className="relative block flex-none" style={{ width: "1.26em", height: "1em" }} aria-hidden="true">
        <span
          className="absolute rounded-full bg-ac"
          style={{
            left: ".5em",
            top: ".13em",
            width: ".76em",
            height: ".76em",
            WebkitMaskImage: "radial-gradient(circle,transparent 0 .095em,#000 calc(.095em + 1px))",
            maskImage: "radial-gradient(circle,transparent 0 .095em,#000 calc(.095em + 1px))",
          }}
        />
        <span className="absolute bg-current" style={{ left: 0, top: ".13em", width: ".74em", height: ".76em", borderRadius: ".09em" }} />
      </span>
      {wordmark && (
        <span aria-hidden="true" style={{ fontSize: ".8em", fontWeight: 800, letterSpacing: "-.055em", marginTop: "-.1em" }}>
          katalog
        </span>
      )}
    </span>
  );
}

/** Spinner standing in for a whole section while its data and covers load. */
export function SectionLoader({ className = "" }: { className?: string }) {
  return (
    <div role="status" aria-label="Ładowanie" className={`flex justify-center py-16 ${className}`}>
      <div className="w-8 h-8 rounded-full border-2 border-ac border-t-transparent animate-spin" />
    </div>
  );
}

/** Cover image over a gradient tile with the title initial; hides itself when the image fails. */
export function Cover({
  title,
  seed,
  src,
  alt = "",
  letterSize = 48,
  showTitle = false,
  className = "",
  style,
  children,
}: {
  title: string;
  seed: string;
  src?: string | null;
  alt?: string;
  letterSize?: number;
  /** Print the title on the tile when there is no cover. */
  showTitle?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasImage = Boolean(src) && failedSrc !== src;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: tileBackground(seed), ...style }}>
      {/* Only without an image: while it loads the tile stays plain instead of flashing the initial. */}
      {!hasImage && (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center font-extrabold text-white/25"
          style={{ fontSize: letterSize }}
        >
          {initialOf(title)}
        </span>
      )}
      {!hasImage && showTitle && (
        <span aria-hidden="true" className="absolute left-2 right-2 bottom-2 text-[11px] font-bold leading-[1.15] text-white/90">
          {title}
        </span>
      )}
      {hasImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={alt}
          onError={() => setFailedSrc(src!)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {children}
    </div>
  );
}

/**
 * Bottom sheet with a dimmed backdrop. Content stays mounted so it can slide in and out.
 * Rendered into <body> so it sits above the tab bar regardless of the screen's stacking context.
 */
export function Sheet({
  open,
  onClose,
  label,
  children,
  className = "",
  full,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  className?: string;
  /** Tall sheet starting 64px below the top. */
  full?: boolean;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-30 bg-black/60 transition-opacity duration-300"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-hidden={!open}
        inert={!open}
        className={`fixed left-0 right-0 bottom-0 z-[31] mx-auto max-w-[480px] bg-s1 rounded-t-[28px] border-t border-s2 flex flex-col ${full ? "top-16" : ""} ${className}`}
        style={{
          transform: open ? "translateY(0)" : "translateY(105%)",
          transition: "transform .45s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div className="w-10 h-[5px] rounded-full bg-s2 self-center mt-2.5 mb-1.5 flex-none" />
        {children}
      </div>
    </>,
    document.body
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed top-[max(16px,env(safe-area-inset-top))] left-5 right-5 z-[60] flex justify-center pointer-events-none">
      <div
        role="status"
        className="flex items-center gap-2 px-4 py-[11px] rounded-full bg-s2 border border-white/10 shadow-[0_16px_36px_-10px_rgba(0,0,0,.7)] text-sm font-medium"
        style={{ animation: "kToastIn .3s ease-out" }}
      >
        <Icon name="check_circle" size={20} fill className="text-ac" />
        {message}
      </div>
    </div>
  );
}

const CHIP_ON = "bg-tx text-bg border-tx";
const CHIP_OFF = "bg-white/[.06] text-tx border-white/15";

export function Chip({
  active,
  onClick,
  children,
  role,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  role?: "tab";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-selected={role ? active : undefined}
      aria-pressed={role ? undefined : active}
      onClick={onClick}
      className={`flex-none flex items-center gap-[7px] h-[34px] px-[15px] rounded-[17px] border text-[13px] font-semibold backdrop-blur-[10px] transition-all ${active ? CHIP_ON : CHIP_OFF}`}
    >
      {children}
    </button>
  );
}
