import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void QRCode.toDataURL(value, {
      margin: 1,
      width: 240,
      color: { dark: "#07060D", light: "#FFFFFF" },
    }).then((url) => {
      if (live) setSrc(url);
    });
    return () => {
      live = false;
    };
  }, [value]);
  if (!src) return <div className="h-44 w-44 animate-pulse rounded-2xl bg-surface-2" />;
  return <img src={src} alt="Deposit address QR code" className="h-44 w-44 rounded-2xl bg-fg p-2" />;
}
