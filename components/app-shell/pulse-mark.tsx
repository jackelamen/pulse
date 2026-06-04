import Image from "next/image";

export function PulseMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <Image
      src="/icons/pulse.png"
      alt="Pulse"
      width={48}
      height={48}
      className={className}
      priority
    />
  );
}
