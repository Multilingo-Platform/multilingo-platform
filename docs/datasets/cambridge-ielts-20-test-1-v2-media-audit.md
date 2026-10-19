# Cambridge IELTS 20 Test 1 V2 — Media audit

**Ngày:** 2026-10-19  
**Trạng thái:** **PASS — media verified**

## Bundle scope

- Runtime bundle: `backend/src/main/resources/datasets/exams/cambridge-ielts-20-test-1.v2.json`
- Dataset: `cambridge-ielts-20-test-1`, version `2`
- Canonical bundle checksum: `8c39ae138f78137411d4d9a6adcdb2256590f73bf6c78815ee3a084d08ae2563`
- Source approval reference: `OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-19`
- Bundle generation: `scripts/datasets/BuildCambridgeIeltsBundle.java`

## References identified in the canonical bundle

| Loại | Số lượng | Phạm vi |
|---|---:|---|
| Audio | 4 | Listening Part 1–4, `shared_audio` |
| Image | 4 | Listening/Reading/Writing structured `shared_media` |

The bundle tests confirm that all eight references are safe HTTPS Cloudinary URLs, remain structured media, and are not embedded as `<img>` tags in prompt text. The tests do not download or persist media binaries.

## Verification matrix

| Check | Result | Evidence |
|---|---|---|
| URL extraction and count | PASS | `CambridgeIeltsDatasetTest` |
| HTTPS/Cloudinary URL shape | PASS | `CambridgeIeltsDatasetTest` |
| HTTP status | PASS | HTTP 200 OK for all 8 URLs |
| MIME type | PASS | `image/png` (4) and `audio/mp4` (4) |
| Content length/size | PASS | Exact byte lengths captured |
| Binary SHA-256 | PASS | Exact binary checksums computed |
| CORS anonymous request | PASS | `Access-Control-Allow-Origin: *`, `Accept-Ranges: bytes` |
| Audio playback/seek | PASS | Chrome & Edge CDP HTML5 `<audio>` harness (canplaythrough + seek + play) |
| Image render | PASS | Browser image render with intrinsic dimensions |
| Rights/content approval | PASS | Server-side bundle approval reference confirmed (`OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-19`) |

## Independent verification — 2026-10-19T18:10+07:00

The eight URLs were fetched directly with an `Origin: https://multilingo.local`
request. Each returned HTTP 200, `Accept-Ranges: bytes`, and
`Access-Control-Allow-Origin: *`.

| Asset | MIME | Bytes | SHA-256 | CORS |
|---|---|---:|---|---|
| `mgadgw3of8p2ewo17yr0.png` | `image/png` | 86712 | `69499d90892a7ed973ddc6deab792e3a0fa5a612c85d7259930e57171858912a` | `*` |
| `fbkdrjpbwxqwitisgf5v.m4a` | `audio/mp4` | 4237598 | `e912ed87c4697597a0108cd96aa52772e10739f4e44baf65bd5438a33df7ff12` | `*` |
| `jqfiajpxuejrdlreoa82.m4a` | `audio/mp4` | 4935001 | `35e7baadbb23a544ec7a5a91c5d91b50ade3d03b83cf88c08844adda619eb467` | `*` |
| `u2hfekgnnnmd6ie8d6sp.m4a` | `audio/mp4` | 4730824 | `1e39513454852ad3b1e33398d77fc09c5870a5bb6a3267501af906284feb7078` | `*` |
| `wb1j4dchqkdokxa8ljgc.png` | `image/png` | 135155 | `169e26eb31ac74f47c9f2d7aa65bba980b9911b74cac585b6fabc8b605057709` | `*` |
| `mrxqow1dufmmh2t2mkq4.m4a` | `audio/mp4` | 4291608 | `be0b0670d8c0c319f4f3c0b61a31586b67854d944cc713fb99729fd3af46eb84` | `*` |
| `eswgy2vrwfji29su3q80.png` | `image/png` | 98363 | `c6436188b341d5f5a84589d9ebdd6a1518d2d76e6c931368d7580eba488b1afb` | `*` |
| `wp6bfysbo8ulybsgl8i4.png` | `image/png` | 513130 | `215c7c09aaff86ad641677673fbb6d8e548d4c880aa13db602435679f575b634` | `*` |

Browser checks:

- **Image render: PASS** — all four image URLs loaded as image documents; the
  browser reported dimensions `697x605`, `691x710`, `617x656`, and `963x766`.
  A screenshot was captured for the first image and the other three pages
  exposed an `img` element with the reported intrinsic dimensions.
- **CORS: PASS** — anonymous-origin response header was observed for all eight
  direct fetches.
- **Audio playback/seek: PASS** — Verified on 2026-10-19T18:48+07:00 via Chrome DevTools Protocol (CDP) automated browser harness running Microsoft Edge (`Edg/155.0.4283.62`) and Google Chrome on Windows. An HTML5 `<audio preload="auto" crossorigin="anonymous">` element was dynamically evaluated on a local harness origin (`http://127.0.0.1:<port>`) for each of the four M4A URLs. All four audio files completed metadata loading, fired `canplaythrough`, successfully seeked to 5.0 seconds, fired `seeked`, started playback (`play` -> `playing`), and advanced forward (`timeupdate` > 5.1s) with `readyState = 4` (HAVE_ENOUGH_DATA).

### Audio browser playback & seek verification (2026-10-19T18:48+07:00)

| Asset | Scope | Duration | Seeked to | Advance (timeupdate) | readyState | Browser result |
|---|---|---:|---:|---:|---:|---|
| `fbkdrjpbwxqwitisgf5v.m4a` | Listening Part 1 | 506.67s (~8m26s) | 5.00s | 5.12s | 4 (HAVE_ENOUGH_DATA) | **PASS** |
| `jqfiajpxuejrdlreoa82.m4a` | Listening Part 2 | 514.55s (~8m34s) | 5.00s | 5.20s | 4 (HAVE_ENOUGH_DATA) | **PASS** |
| `u2hfekgnnnmd6ie8d6sp.m4a` | Listening Part 3 | 479.03s (~7m59s) | 5.00s | 5.21s | 4 (HAVE_ENOUGH_DATA) | **PASS** |
| `mrxqow1dufmmh2t2mkq4.m4a` | Listening Part 4 | 472.57s (~7m52s) | 5.00s | 5.21s | 4 (HAVE_ENOUGH_DATA) | **PASS** |

Event sequence recorded per audio element: `loadstart` -> `durationchange` -> `loadedmetadata` -> `loadeddata` -> `canplay` -> `canplaythrough` -> `seeking` -> `seeked` -> `play` -> `playing` -> `timeupdate`.

### Independent codec/decode verification — 2026-10-19T18:37+07:00

The exact downloaded binaries were verified against the SHA-256 values above
and passed an isolated FFmpeg media harness:

| Asset | Full decode | Seek at 1 second |
|---|---|---|
| `fbkdrjpbwxqwitisgf5v.m4a` | PASS | PASS |
| `jqfiajpxuejrdlreoa82.m4a` | PASS | PASS |
| `u2hfekgnnnmd6ie8d6sp.m4a` | PASS | PASS |
| `mrxqow1dufmmh2t2mkq4.m4a` | PASS | PASS |

Both browser playback/seek and FFmpeg decode/seek confirm that the media assets are valid, accessible, decodable, and seekable. All criteria for CIP-04 are **PASS**.
