import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

// The favicon's four spines on a shelf, drawn at home-screen size. iOS rounds
// the corners itself, so the cream runs edge to edge.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const SPINES = [
  { color: BRAND.p1, height: 116 },
  { color: BRAND.p2, height: 104 },
  { color: BRAND.p3, height: 124 },
  { color: BRAND.p4, height: 110 },
];

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          background: BRAND.bg,
          paddingBottom: 30,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 5 }}>
          {SPINES.map((s) => (
            <div
              key={s.color}
              style={{
                width: 26,
                height: s.height,
                background: s.color,
                display: "flex",
                flexDirection: "column",
                paddingTop: 14,
              }}
            >
              {/* the label band that makes a bar read as a book spine */}
              <div style={{ height: 8, background: BRAND.bg, opacity: 0.85 }} />
            </div>
          ))}
        </div>
        <div style={{ width: 132, height: 12, background: BRAND.ink }} />
      </div>
    ),
    size,
  );
}
