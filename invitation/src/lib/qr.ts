import QRCode from "qrcode";

/** Crisp SVG QR code (string) for printed stationery; empty when no URL. */
export async function qrSvg(url: string | undefined): Promise<string> {
  if (!url) return "";
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#3b2531", light: "#ffffff00" },
  });
}
