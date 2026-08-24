import { useId, type ReactElement } from 'react'
import type { RootAccent, RootEngraving } from './model'

export const ROOT_ENGRAVINGS: RootEngraving[] = [
  'heart',
  'brain',
  'gear',
  'chicken',
  'gabe',
  'code',
  'parallel',
  'orbit'
]

export const ROOT_ENGRAVING_LABELS: Record<RootEngraving, string> = {
  heart: 'Heart',
  brain: 'Brain',
  gear: 'Gear',
  chicken: 'Chicken',
  gabe: 'Gabe',
  code: 'Code',
  parallel: 'Parallel',
  orbit: 'Orbit'
}

const ROOT_ACCENT_RGB: Record<RootAccent, string> = {
  teal: '99, 219, 255',
  aqua: '53, 232, 216',
  sky: '87, 174, 255',
  blue: '116, 189, 255',
  indigo: '103, 110, 255',
  violet: '169, 135, 255',
  purple: '205, 92, 255',
  magenta: '255, 75, 215',
  pink: '255, 124, 190',
  rose: '255, 101, 127',
  red: '255, 75, 75',
  coral: '255, 119, 104',
  orange: '255, 133, 56',
  amber: '255, 174, 85',
  yellow: '255, 220, 70',
  lime: '184, 244, 76',
  green: '91, 236, 163',
  emerald: '43, 211, 139'
}

export function rootAccentRgb(accent: RootAccent | undefined): string {
  return ROOT_ACCENT_RGB[accent ?? 'teal']
}

export function normalizeRootEngraving(value: unknown): RootEngraving | undefined {
  return ROOT_ENGRAVINGS.find((engraving) => engraving === value)
}

export function inferRootEngraving(root: { id: string; title: string }): RootEngraving {
  const signature = `${root.id} ${root.title}`.toLowerCase()

  if (signature.includes('health') || signature.includes('wellness')) return 'heart'
  if (signature.includes('career') || signature.includes('profession')) return 'brain'
  if (
    signature.includes('home') ||
    signature.includes('house') ||
    signature.includes('improvement') ||
    signature.includes('repair')
  ) {
    return 'gear'
  }
  if (signature.includes('chicken')) return 'chicken'
  if (signature.includes('gabe')) return 'gabe'
  if (
    signature.includes('code') ||
    signature.includes('software') ||
    signature.includes('engineering') ||
    root.id.toLowerCase() === 'ng'
  ) {
    return 'code'
  }
  if (signature.includes('parallel') || signature.includes('chore')) return 'parallel'

  return 'orbit'
}

export function EngravingGlyph({
  type,
  className,
  title
}: {
  type: RootEngraving
  className?: string
  title?: string
}): ReactElement {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {engravingMotif(type)}
    </svg>
  )
}

export function EngravingPattern({
  type,
  className
}: {
  type: RootEngraving
  className?: string
}): ReactElement {
  const patternId = useId().replace(/:/g, '')

  return (
    <svg
      className={className}
      viewBox="0 0 600 600"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <defs>
        <pattern id={patternId} width="220" height="220" patternUnits="userSpaceOnUse">
          <g className="engraving-pattern__tile">
            <g transform="translate(22 22) scale(.72)" opacity=".30">
              {engravingMotif(type)}
            </g>

            <g
              transform="translate(126 118) scale(.54)"
              opacity=".20"
              strokeDasharray="12 10"
              strokeDashoffset="6"
            >
              {engravingMotif(type)}
            </g>

            <g
              transform="translate(-34 120) scale(.48)"
              opacity=".14"
              strokeDasharray="8 8"
            >
              {engravingMotif(type)}
            </g>

            <g className="engraving-pattern__tile-fragments" opacity=".24">
              {engravingTileFragments(type)}
            </g>
          </g>
        </pattern>
      </defs>

      <rect x="0" y="0" width="600" height="600" fill={`url(#${patternId})`} stroke="none" />

      <g className="engraving-pattern__fragments" opacity=".34">
        {engravingFragments(type)}
      </g>
    </svg>
  )
}

function engravingMotif(type: RootEngraving): ReactElement {
  switch (type) {
    case 'heart':
      return (
        <>
          <path d="M60 101C33 82 17 66 17 43c0-14 10-25 24-25 9 0 15 4 19 12 5-8 11-12 20-12 13 0 23 11 23 25 0 23-16 39-43 58Z" />
          <path d="M28 58h18l7-14 13 30 8-17h18" />
        </>
      )
    case 'brain':
      return (
        <>
          <path d="M48 101H39c-11 0-20-9-20-20 0-5 2-10 6-14-6-4-9-10-9-18 0-9 5-17 13-21 1-11 10-19 21-19 7 0 13 3 17 8 4-5 10-8 17-8 11 0 20 8 21 19 8 4 13 12 13 21 0 8-3 14-9 18 4 4 6 9 6 14 0 11-9 20-20 20h-9" />
          <path d="M60 18v84M46 29c-10 1-16 7-16 16M74 29c10 1 16 7 16 16" />
          <path d="M35 58h12l7 8M85 58H73l-7 8M34 78h14M86 78H72" />
        </>
      )
    case 'gear':
      return (
        <>
          <path d="M60 12 69 23 83 20 88 34 102 39 97 53 108 60 97 68 102 82 88 87 83 101 69 98 60 109 51 98 37 101 32 87 18 82 23 68 12 60 23 53 18 39 32 34 37 20 51 23 60 12Z" />
          <circle cx="60" cy="60" r="22" />
          <circle cx="60" cy="60" r="8" />
        </>
      )
    case 'chicken':
      return (
        <>
          <ellipse cx="58" cy="68" rx="36" ry="27" />
          <circle cx="85" cy="43" r="17" />
          <path d="M99 42h14l-12 8" />
          <path d="M76 28c0-7 8-8 10-2 2-8 11-6 10 2 7-4 12 3 7 8" />
          <path d="M24 61 10 50l5 19-7 10 19-3" />
          <path d="M42 65c10-12 26-9 31 4-9 11-22 13-31 4Z" />
          <circle cx="90" cy="39" r="2.5" fill="currentColor" stroke="none" />
          <path d="M48 94v13M72 94v13M40 107h16M64 107h16" />
        </>
      )
    case 'gabe':
      return (
        <>
          <path d="M60 10 101 34v52L60 110 19 86V34L60 10Z" />
          <path d="M82 42c-6-9-15-13-25-13-18 0-31 13-31 31s13 31 31 31c12 0 21-5 27-12V61H60v13h10c-3 3-8 5-13 5-11 0-18-8-18-19s7-19 18-19c6 0 11 2 15 7l10-6Z" />
        </>
      )
    case 'code':
      return (
        <>
          <path d="m48 30-28 30 28 30M72 30l28 30-28 30M70 18 50 102" />
          <path d="M28 24h16M76 96h16M23 96h12M85 24h12" />
        </>
      )
    case 'parallel':
      return (
        <>
          <path d="M18 35h70M78 24l11 11-11 11" />
          <path d="M102 85H32M42 74 31 85l11 11" />
          <path d="M39 35v20c0 8 6 14 14 14h14c8 0 14 6 14 14v2" />
          <path d="M81 35v10c0 8-6 14-14 14H53c-8 0-14 6-14 14v12" />
        </>
      )
    case 'orbit':
      return (
        <>
          <ellipse cx="60" cy="60" rx="50" ry="21" transform="rotate(24 60 60)" />
          <ellipse cx="60" cy="60" rx="50" ry="21" transform="rotate(-24 60 60)" />
          <ellipse cx="60" cy="60" rx="22" ry="50" />
          <circle cx="60" cy="60" r="9" />
        </>
      )
  }
}



function engravingTileFragments(type: RootEngraving): ReactElement {
  switch (type) {
    case 'heart':
      return (
        <>
          <path d="M16 114h54l10-20 16 42 14-28h44" strokeDasharray="18 9 4 9" />
          <path d="M156 34c12-12 30-10 40 4" strokeDasharray="10 8" />
          <path d="M118 188h48l8-15 13 27" strokeDasharray="12 8" />
        </>
      )
    case 'brain':
      return (
        <>
          <path d="M14 52h52l18 18h34" strokeDasharray="16 8" />
          <path d="M104 172h48l18-18h34" strokeDasharray="10 9" />
          <circle cx="84" cy="70" r="4" fill="currentColor" stroke="none" />
          <circle cx="154" cy="152" r="4" fill="currentColor" stroke="none" />
        </>
      )
    case 'gear':
      return (
        <>
          <path d="M20 52a44 44 0 0 1 50-24" strokeDasharray="18 10 4 10" />
          <path d="M150 152a42 42 0 0 0 48-34" strokeDasharray="12 9" />
          <path d="M40 176h20M164 42v22" />
        </>
      )
    case 'chicken':
      return (
        <>
          <path d="M28 62c10-8 23-8 34 0" strokeDasharray="10 8" />
          <path d="M124 178c10-7 22-7 34 0" />
          <path d="m36 190 9-10 9 10M142 186l9-10 9 10" strokeDasharray="6 6" />
          <path d="M96 26c7-6 16-6 23 0" strokeDasharray="6 7" />
        </>
      )
    case 'gabe':
      return (
        <>
          <path d="m32 34 6 12 14 2-10 10 3 14-13-7-13 7 3-14-10-10 14-2 6-12Z" />
          <path d="M118 182h36M176 112v36" strokeDasharray="12 8" />
        </>
      )
    case 'code':
      return (
        <>
          <path d="m42 36-20 20 20 20M176 144l20 20-20 20" strokeDasharray="14 8" />
          <path d="M104 18 86 88M156 136l-16 54" strokeDasharray="18 9 4 9" />
          <path d="M14 128h38M166 88h38" />
        </>
      )
    case 'parallel':
      return (
        <>
          <path d="M18 44h70M72 34l16 10-16 10" strokeDasharray="18 9" />
          <path d="M202 178h-56M162 168l-16 10 16 10" strokeDasharray="12 9" />
          <path d="M64 136c20 0 20-22 40-22M156 86c-20 0-20 22-40 22" />
        </>
      )
    case 'orbit':
      return (
        <>
          <path d="M16 58c42-36 103-48 158-30" strokeDasharray="18 10 4 10" />
          <path d="M46 14c-30 54-22 122 20 166" strokeDasharray="12 9" />
          <circle cx="46" cy="58" r="4" fill="currentColor" stroke="none" />
          <circle cx="172" cy="154" r="4" fill="currentColor" stroke="none" />
        </>
      )
  }
}

function engravingFragments(type: RootEngraving): ReactElement {
  switch (type) {
    case 'heart':
      return (
        <>
          <path d="M18 118h82l18-34 24 68 24-45h74" strokeDasharray="34 16 7 16" />
          <path d="M360 468h54l14-27 20 51 17-31h116" strokeDasharray="22 13" />
          <path d="M252 70c22-22 57-18 74 8" strokeDasharray="15 12" />
        </>
      )
    case 'brain':
      return (
        <>
          <path d="M24 132h78l32 32h48M424 110h74l28 28h54" strokeDasharray="24 12" />
          <path d="M44 432h92l26-26h58M386 486h82l36-36h70" strokeDasharray="12 11" />
          <circle cx="134" cy="164" r="5" fill="currentColor" stroke="none" />
          <circle cx="504" cy="450" r="5" fill="currentColor" stroke="none" />
        </>
      )
    case 'gear':
      return (
        <>
          <path d="M34 152A126 126 0 0 1 176 32M426 56a132 132 0 0 1 144 132" strokeDasharray="32 18 8 18" />
          <path d="M28 446a116 116 0 0 0 132 122M432 554a118 118 0 0 0 142-108" strokeDasharray="18 14" />
          <path d="M130 84v34M500 458v42M70 500h38M490 102h40" />
        </>
      )
    case 'chicken':
      return (
        <>
          <path d="M40 158c20-18 45-20 70-7M477 126c24-16 52-13 72 6" strokeDasharray="15 10" />
          <path d="M90 505c18-13 38-13 56 0M454 486c19-13 40-13 60 0" />
          <path d="m74 534 13-14 13 14M468 519l13-14 13 14" strokeDasharray="8 7" />
          <path d="M276 78c12-10 28-10 40 0" strokeDasharray="8 9" />
        </>
      )
    case 'gabe':
      return (
        <>
          <path d="m82 86 8 17 19 2-14 13 4 19-17-9-17 9 4-19-14-13 19-2 8-17Z" />
          <path d="m500 438 8 17 19 2-14 13 4 19-17-9-17 9 4-19-14-13 19-2 8-17Z" strokeDasharray="12 9" />
          <path d="M38 282h82M480 300h82M280 28v70M304 496v76" strokeDasharray="18 12" />
        </>
      )
    case 'code':
      return (
        <>
          <path d="m96 102-52 52 52 52M504 394l52 52-52 52" strokeDasharray="22 12" />
          <path d="M202 30 156 188M446 414l-40 142" strokeDasharray="28 14 6 14" />
          <path d="M26 340h88M486 236h88" />
        </>
      )
    case 'parallel':
      return (
        <>
          <path d="M26 116h156M156 98l26 18-26 18" strokeDasharray="34 12" />
          <path d="M574 470H418M444 452l-26 18 26 18" strokeDasharray="20 14" />
          <path d="M70 354h108M420 250h110" strokeDasharray="10 10" />
          <path d="M178 354c38 0 38-42 76-42M420 250c-38 0-38 42-76 42" />
        </>
      )
    case 'orbit':
      return (
        <>
          <path d="M24 156c90-82 220-108 334-70M578 454c-90 82-220 108-334 70" strokeDasharray="32 18 8 18" />
          <path d="M112 26c-64 118-46 268 47 365M488 574c64-118 46-268-47-365" strokeDasharray="18 14" />
          <circle cx="112" cy="156" r="6" fill="currentColor" stroke="none" />
          <circle cx="492" cy="448" r="6" fill="currentColor" stroke="none" />
        </>
      )
  }
}
