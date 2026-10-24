# Provider research — 2026-10-22

These are observed public frontend contracts, not published integration guarantees. No live meter readings or fabricated accounts were sent to providers during research or testing.

## Gazprom Kyrgyzstan

- Current official site: https://www.gazprom.kg/
- Public meter form is reachable from «Показание за газ». It accepts an account and reading without a user login or visible CAPTCHA.
- Observed assets: `/assets/index-ae80RWzP.js`, `/assets/HomePage-BJckuMNv.js`, `/assets/AttachmentModal-dPYFEfyM.js`.
- API: `POST https://api.gazprom.kg/api/v1/facility/readings`.
- JSON: `account` is a nine-digit string; `reading` is an integer, greater than zero, at most seven digits in the frontend. Leading zeros in account are preserved.
- Headers: `Accept: application/json`, `Content-Type: application/json`, `Lang: ru`, public `api-token` from the official client. Optional `auth-token` is only for signed-in users and is not required by the public form.
- Success UI consumes `consumption`, `payAmount`, `tariff`; no receipt ID observed. Our confirmation requires all three fields to be finite nonnegative numeric values and no explicit failure. This still needs validation on the user's first real submission.
- HTTP 409 presents an error for a reading lower than the previous value; the site's recalculation button is intentionally not automated.
- News https://www.gazprom.kg/consumers/news/530 recommends 15–30 monthly. The observed homepage permits 10–31. UI recommends 15–30; the server rejects days before the observed opening day. Any provider-side refusal still takes precedence.
- Browser/client key bootstrap and a read-only public news API were observed; no live write was made.

## Bishkekvodokanal

- Entry: https://voda.link.kg/send/
- Observed scripts: `/send/main.js?v=050226.014640`, `/send/app.js?v=050226.023731`.
- JSON POST to the active `/send/{provider-returned-path}`:
  - Login: `{ mode: "login", data: "account" }`; frontend uses response index 1 for the next path.
  - Load: `{ mode: "loadForm", account }`; response includes `waterMeters`, `lastRows`, `glob_update_pok`.
  - Write: `{ mode: "upSert", account, data: [...] }`.
- Meter fields: `data-address`, `data-branchid`, `data-clientid`, `data-hg`, `data-hydid`, `data-hydnum`, `data-vodpp`, and `value`.
- `HG=H`: cold water. `HG=G`: hot water for drainage. These are not interchangeable with a separate heat-provider submission.
- Confirmation: `ok`, `result.ID_ROW`, `result.insert`, `result.update`. Our helper requires complete matching receipt rows and operation flags.
- Official UI rounds decimal input upward with `Math.ceil`. We refuse decimal adapter writes until the user explicitly chooses the intended integer; no silent rounding.
- Current frontend gates access on mandatory notifications/device registration. **This flow is not bypassed.** Water sending is not wired into production. Need the user's authorized account and compliant official access before finishing this integration.

## Bishkekteploset

- User article: https://www.teploseti.kg/content/articles_view/1297
- Actual cabinet: https://data.teploseti.kg/
- Account login form: POST to current URL with form field `account`.
- Public scripts show `/ajax/gethis/` for history and reCAPTCHA support; this does not establish the authenticated submit contract.
- Meter submission is advertised for the 20th–25th each month. Do not apply this window to all other providers.
- Reading write endpoint, authenticated session and success response remain unverified. No account enumeration was performed. Manual handoff only.

## Electricity / NESK

- https://www.nesk.kg/ru/abonentam/moj-svet/
- https://nesk.kg/ru/abonentam/balans-abonenta/
- «Мой свет» documents balances, consumption and bills. Its public description does not establish manual reading submission.
- Balance form uses CAPTCHA. No CAPTCHA bypass or unsupported balance API added.
- Official ASKUE article: https://www.nesk.kg/ru/press-centr/novosti-i-press-relizy/oao-nesk-pokazyvaet-kak-obychnyj-schetchik-stanovitsya-umnym-ustanovka-askue/
- ASKUE meters submit automatically. Need to identify the user's meter type before implementing a manual workflow.
