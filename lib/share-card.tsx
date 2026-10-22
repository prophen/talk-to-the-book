import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND } from "./brand";

// The share image behind both the Open Graph and the Twitter card: the hero
// headline over the four-color chapter strip, the same way the page opens.

export const SHARE_SIZE = { width: 1200, height: 630 };
export const SHARE_ALT =
  "Talk to the Book: dictate a memory, get a first draft filed into your book, hear it read back.";

const STEPS = [
  { label: "Talk", bg: BRAND.p1, fg: BRAND.onDark },
  { label: "Draft", bg: BRAND.p2, fg: BRAND.onLight },
  { label: "File", bg: BRAND.p3, fg: BRAND.onDark },
  { label: "Listen", bg: BRAND.p4, fg: BRAND.onDark },
];

const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));

export async function shareCard() {
  const [archivoBlack, serifItalic] = await Promise.all([
    font("ArchivoBlack-Regular.woff"),
    font("SourceSerif4-Italic.woff"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BRAND.bg,
          color: BRAND.ink,
          padding: "64px 72px 56px",
          fontFamily: "Archivo Black",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div
            style={{
              fontSize: 124,
              lineHeight: 0.9,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Talk to the</span>
            <span style={{ color: BRAND.p4 }}>Book</span>
          </div>
          <div
            style={{
              fontFamily: "Source Serif 4",
              fontStyle: "italic",
              fontSize: 36,
              color: BRAND.muted,
              maxWidth: 940,
            }}
          >
            Say a memory out loud. Get back a first draft, filed into the right part of your book.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {STEPS.map((s, i) => (
            <div
              key={s.label}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                background: s.bg,
                color: s.fg,
                padding: "16px 20px 18px",
              }}
            >
              <span style={{ fontSize: 18, letterSpacing: "0.12em", opacity: 0.85 }}>
                {`STEP ${i + 1}`}
              </span>
              <span style={{ fontSize: 40, textTransform: "uppercase" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...SHARE_SIZE,
      fonts: [
        { name: "Archivo Black", data: archivoBlack, weight: 400, style: "normal" },
        { name: "Source Serif 4", data: serifItalic, weight: 400, style: "italic" },
      ],
    },
  );
}
