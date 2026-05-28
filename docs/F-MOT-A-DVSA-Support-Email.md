# DVSA support — request to investigate Incapsula 403 (F-MOT-A)

**Send to:** `dvsa-tech@dft.gov.uk` (or the address DVSA provided in the
approval email — check the original message before sending).

**Subject:**

```
MOT History API — Incapsula 403 on authenticated requests (Client ID 22aea53d…)
```

---

**Body:**

> Hello DVSA Tech Team,
>
> We were granted MOT History API access on 26 May 2026 (Client ID
> `22aea53d-1f54-4a53-9d40-15e191ce05a6`, tenant
> `a455b827-244f-4c97-b5b4-ce5d13b4d00c`). The Microsoft Entra token
> exchange against
> `https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token`
> succeeds (HTTP 200, valid access_token returned with scope
> `https://tapi.dvsa.gov.uk/.default`).
>
> However, **every authenticated request to the history endpoint is
> being blocked by your upstream WAF (Imperva Incapsula) with a generic
> HTTP 403 HTML interstitial.** We have tried:
>
> - Endpoint variants: `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/{reg}` and `/v6/trade/vehicles/registration/{reg}`
> - `Accept` headers: `application/json`, `application/json+v6`, `application/vnd.api.v1+json`
> - `X-API-Key`, `Authorization: Bearer <token>`, and a real `User-Agent`
> - Reg `EK18FUT` (and others)
>
> The response is always the same Incapsula interstitial. Incident IDs
> from our latest attempts (please use these to look up the WAF rule
> that's firing):
>
> ```
> 687000630139686925-230409151341072327
> 687000630139686925-136579238503321538
> 687000630139686925-202349507226046412
> ```
>
> Could you please confirm:
>
> 1. That our Client ID is fully provisioned at the data endpoint
>    (not just at Microsoft Entra)?
> 2. Whether we need to provide an IP range to be allow-listed at
>    the WAF? (Our server-side requests originate from
>    Vercel's UK pop addresses in production; my development machine
>    IP for the test traces above is `103.86.52.202`.)
> 3. The correct `Accept` header value and current endpoint version
>    for an account approved this week.
>
> Happy to provide any additional captures or run a guided test. Thank
> you for your help.
>
> Kind regards,
> Syed Jaffery
> Car Capital UK

---

**Once DVSA confirm provisioning + WAF allow-list:**

1. Re-run the curl probe (or use the form's **Re-fetch** button on
   `EK18FUT`).
2. Confirm the route returns `sources.dvsa: "ok"` and `motStatus`
   reflects the DVSA-derived value (likely "Not valid" with
   `motExpiryDate: 2026-03-01` for `EK18FUT`).
3. Mark UAT case `MF-R15` as **PASS** in
   `docs/UAT-DVLA-DVSA-LOOKUP.md` §7.
4. Run §4 cases marked `N` (Ali walkthrough). Add any new findings
   to §7.
5. Greenlight the commit per `docs/UAT-DVLA-DVSA-LOOKUP.md` §8.

**No further code changes should be required** — the route is already
written to flip `sources.dvsa` from `"error"` to `"ok"` the moment the
WAF starts letting our requests through.
