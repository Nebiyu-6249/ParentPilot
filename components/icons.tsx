import type { SVGProps } from "react";

/**
 * The icon set. Ours, not a library.
 *
 * Specification: 24px grid, 1.5px stroke, round caps, mitred joins to echo the
 * four-pointed compass in the logo, and no rounded corners anywhere (`rx` is
 * never set). Everything is `currentColor`, so an icon takes the colour of the
 * text it labels and works on paper and on the teal desk without a variant.
 *
 * Rule of use: an icon labels an action or a category. Never decoration, never
 * inside body prose.
 */

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** Rendered square size in px. */
  size?: number;
  className?: string;
}

function Icon({ size = 24, className, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="miter"
      className={className}
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** The compass diamond, the shape every other icon borrows from. */
const DIAMOND = "M12 4 L14 10 L20 12 L14 14 L12 20 L10 14 L4 12 L10 10 Z";

export function CompassIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d={DIAMOND} />
      <path d="M12 11.2 L12.8 12 L12 12.8 L11.2 12 Z" />
    </Icon>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 7h4l1.5-2h7L17 7h4v12H3z" />
      <path d="M12 10.5 L13.4 12 L12 13.5 L10.6 12 Z" />
      <path d="M8.6 12a3.4 3.4 0 1 0 6.8 0 3.4 3.4 0 1 0-6.8 0" />
    </Icon>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 14v6h16v-6" />
    </Icon>
  );
}

export function MicrophoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 4h5v9h-5z" />
      <path d="M6 11a6 6 0 0 0 12 0" />
      <path d="M12 17v3" />
      <path d="M8.5 20h7" />
    </Icon>
  );
}

export function MicrophoneOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 4h5v6" />
      <path d="M14.5 13h-5V9" />
      <path d="M6 11a6 6 0 0 0 9.5 4.9" />
      <path d="M12 17v3" />
      <path d="M8.5 20h7" />
      <path d="M4 4l16 16" />
    </Icon>
  );
}

export function TypeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6h16v12H4z" />
      <path d="M7 9.5h1.5M11 9.5h1.5M15.5 9.5H17" />
      <path d="M8.5 14.5h7" />
    </Icon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 3h11v13" />
      <path d="M5 7h11v14H5z" />
    </Icon>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 13v7h14v-7" />
    </Icon>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12.5l5 5L20 6.5" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 L21 19.5 H3 Z" />
      <path d="M12 10v4" />
      <path d="M12 16.6h.01" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 11h14v9H5z" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      <path d="M12 14.5 L13 15.5 L12 16.5 L11 15.5 Z" />
    </Icon>
  );
}

export function UnlockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 11h14v9H5z" />
      <path d="M8 11V8a4 4 0 0 1 7.5-1.9" />
      <path d="M12 14.5 L13 15.5 L12 16.5 L11 15.5 Z" />
    </Icon>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 4.5l12 7.5-12 7.5z" />
    </Icon>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 5h3v14H8z" />
      <path d="M13 5h3v14h-3z" />
    </Icon>
  );
}

export function ChevronIcon({ direction = "down", ...props }: IconProps & { direction?: "up" | "down" | "left" | "right" }) {
  const rotate = { down: 0, left: 90, up: 180, right: 270 }[direction];
  return (
    <Icon {...props} style={{ transform: `rotate(${rotate}deg)`, ...props.style }}>
      <path d="M5 9l7 7 7-7" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 5l14 14" />
      <path d="M19 5L5 19" />
    </Icon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <path d="M9 4.8v4.4M15 9.8v4.4M9.5 14.8v4.4" />
    </Icon>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5v5h5" />
      <path d="M4.6 10a8 8 0 1 1 .9 5.4" />
      <path d="M12 8v4.5l3 1.8" />
    </Icon>
  );
}

/** Teacher note, the thing a parent sends onward. */
export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 11.5L21 4l-7.5 17-2.5-7.5z" />
      <path d="M11 13.5L21 4" />
    </Icon>
  );
}

export function LanguageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4h16v16H4z" />
      <path d="M4 12h16" />
      <path d="M12 4a13 13 0 0 1 0 16 13 13 0 0 1 0-16" />
    </Icon>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.5 12a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" />
      <path d="M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
    </Icon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </Icon>
  );
}

/** Two methods side by side. Used by the Method Match disclosure. */
export function ColumnsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5h7v14H4z" />
      <path d="M13 5h7v14h-7z" />
      <path d="M6.5 9h2M15.5 9h2" />
    </Icon>
  );
}

/** An open page. Used by the "what is this teaching" disclosure. */
export function BookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 6.5v13" />
      <path d="M12 6.5C10.5 5 8.2 4.5 4 4.8v12.6c4.2-.3 6.5.2 8 1.6" />
      <path d="M12 6.5c1.5-1.5 3.8-2 8-1.7v12.6c-4.2-.3-6.5.2-8 1.6" />
    </Icon>
  );
}

/** Something said out loud. Used by the scripts disclosure. */
export function SpeechIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 10.5h8" />
    </Icon>
  );
}

export function AccountIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0" />
      <path d="M4 20.5a8 8 0 0 1 16 0" />
    </Icon>
  );
}
