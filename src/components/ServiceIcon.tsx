export type ServiceIconName = "home" | "building" | "wrench" | "doc";

export function ServiceIcon({ name }: { name: ServiceIconName }) {
  const common = "h-8 w-8 text-white";

  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-7H10v7H5a1 1 0 0 1-1-1v-9.5Z" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "building") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M6 22V4h8v4h6v14H6Z" strokeLinejoin="round" />
        <path d="M10 10h2M10 14h2M14 10h2M14 14h2M10 18h2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "wrench") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.7">
        <path
          d="M14.7 6.3a6 6 0 0 0-8.1 8.1l8.1-8.1Z"
          strokeLinejoin="round"
        />
        <path d="m21 3-4.7 4.7" strokeLinecap="round" />
        <path d="M8.5 15.5 4 20" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      <path d="M14 3v4h4M9 13h6M9 17h4" strokeLinecap="round" />
    </svg>
  );
}
