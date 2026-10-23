# NLTV Sample Test 1 — Media audit R1

**Ngày kiểm tra:** 2026-10-21 (Asia/Saigon)  
**Nguồn workbook:** `Đề_thi_Đánh_giá_Năng_lực_Tiếng_Việt_(NLTV)_Mẫu (1).xlsx`  
**SHA-256 workbook:** `e155c3b007cd5f51cf5a73f8652e7d7274aa4a4953cf0c552b05c670a3582d13`  
**Quyền/provenance:** owner supplied the workbook and explicitly requested NLTV ingestion/publication in this task. This records owner instruction; it is not an independent legal opinion.

## Four source audio tracks

Each URL comes from the first row of its corresponding Part in the workbook (`R2`, `R17`, `R31`, `R45`). Files were fetched to a temporary directory outside the repository and were not added to Git. HTTP headers were read from Cloudinary; SHA-256 was calculated over each full HTTP 200 response. Browser check used Chrome's native MP4 player; the control exposed a finite duration and entered playback. MP4 box inspection independently confirmed one `soun` track and duration to milliseconds. Durations below are from the MP4 movie header, not rounded browser labels.

| Part | Source cell | URL | HTTP | MIME | Bytes | ETag | SHA-256 | Duration (ms) | Browser check |
|---:|---|---|---:|---|---:|---|---|---:|---|
| 1 | R2 | `https://res.cloudinary.com/j5on4xwq/video/upload/v1792517080/wllcoeiywngqxiir9zhr.mp4` | 200 | video/mp4 | 22,781,188 | `ad030e7bedf17ff26204b61cef186dd1` | `26834fc3a01df6df87e8f155200b13e6054195d8c295984e64b34148e7e76ffe` | 941,783 | Loaded and played; displayed 15:41 |
| 2 | R17 | `https://res.cloudinary.com/j5on4xwq/video/upload/v1792517164/mg8mtmpfkx6cw89duheq.mp4` | 200 | video/mp4 | 19,991,644 | `4f2816768c1400b06a4d9838a69e5ae3` | `4d88f9813d807b7a00b79d9d1634929067bab287d68939a201450f65d032ac7e` | 826,473 | Loaded and played; displayed 13:46 |
| 3 | R31 | `https://res.cloudinary.com/j5on4xwq/video/upload/v1792517246/udsrmwcm8ww15stzz0ph.mp4` | 200 | video/mp4 | 18,578,304 | `3c83f453afd1167a05d7371a69e5db82` | `1bdc920d5b6c28b33d0a4e2a4c75bc78e888a7a829cd94a8d3beed73457bcef7` | 768,041 | Loaded and played; displayed 12:47 |
| 4 | R45 | `https://res.cloudinary.com/j5on4xwq/video/upload/v1792517317/go4zqbdhp2gecp2cim7v.mp4` | 200 | video/mp4 | 19,420,468 | `2f1cf8727240d76c479f057105b61338` | `305597bebbf838116d6d596e43a801ea4fe6d6f30297f8a00d8299b98fc418d0` | 802,850 | Loaded and played; displayed 13:22 |

All four responses advertised `Accept-Ranges: bytes` and `Access-Control-Allow-Origin: *`. The MP4s have audio-only tracks. Browser playback was checked by Part URL; semantic transcription/content correctness was not independently assessed. Part association is taken from the supplied workbook row mapping and owner-provided source.

## Writing image

Source: Part 8 group shared media in `F107`  
URL: `https://res.cloudinary.com/j5on4xwq/image/upload/v1792491722/rufoniyxhn5nrjv7tpz5.png`  
HTTP HEAD: `200`, `image/png`, `306,802` bytes, ETag `079c4acf480e73f8be0c418774a414c7`, CORS `*`. The image loaded in Chrome at 490×306 and visually corresponds to the essay prompt. A full response downloaded to the temporary verification directory had SHA-256 `089b1a1c10e30a222622e62d0c4369fb2d6a368985107e4dbba33e2d526d946e`.

## Limits and release note

- Technical retrieval, MIME, hash, media track, duration and direct browser playback are verified. This does not establish legal ownership independently; it records the owner's explicit use/publication request.
- The Part-to-URL mapping is explicit in workbook cells; no transcript was available for independent phrase-by-phrase listening verification.
- The current running frontend/backend and target database were not available on the configured ports during this check. Frontend-origin smoke and database publication remain separate gates.
- No media asset was copied into runtime resources or committed to the repository; the bundle references the source URLs.
