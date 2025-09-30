import logoUrl from "../assets/spontnsend-logo.svg"; // Corrected logo path

export default function Brand({ size = 360 }: { size?: number }) {
  return (
    <img
      src={logoUrl}
      alt="SpotnSend logo"
      style={{ width: size, height: "auto" }}
      draggable={false}
    />
  );
}
