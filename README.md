# Modern Front-End Security

This project hardens the supplied User Security Dashboard while preserving its
dashboard, profile, account, and settings functionality. The examples follow
the training material's source-to-sink and defense-in-depth approach.

## Setup and verification

```bash
npm install
npm test
npm start
```

Open <http://localhost:3000>. The automated tests cover positive and negative
scenarios for all five assignment topics.

Demo profile: Sahil Mujawar (`sahil.mujawar@rajasoftwarelabs.com`).

Theme and font size apply to the page; the language selection updates the
document's `lang` attribute. Settings are retained in Express memory across
page reloads and reset when the server restarts.

## Run and record the demonstration

1. Run `npm test`, then start the app with `npm start`.
2. Open `http://localhost:3000` in a browser and show the dashboard and settings.
3. Demonstrate DOM XSS by opening
   `http://localhost:3000/?name=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E`;
   the value should display as text.
4. Change and save theme/font size, then reload to show settings persist.
   Visit `/api/settings` to show saved values; try an unknown settings key with
   DevTools or a REST client and show the HTTP 400 response.
5. Visit `/api/profile` and show only the public fields. Open `/account` and
   show the account details.
6. Show response headers in DevTools Network: CSP, `frame-ancestors 'none'`,
   and `X-Frame-Options: DENY`. Open `test/iframe-test.html` to demonstrate the
   browser refusing to embed the account page.
7. Record the browser with QuickTime Player (**File → New Screen Recording**)
   or the operating system's screen recorder. Keep the recording silent or
   enable narration if desired, then save the clip as `security-demo.mov`.

## Part A: code-review findings

The findings for the standalone snippet are listed in [`answers.txt`](answers.txt).
The main review principle is to follow every value from its source (URL,
browser storage, or API) to its sink (DOM, object assignment, or client
renderer). Input from those sources is untrusted until validated for its
intended use.

## Part B: vulnerabilities, fixes, and learning notes

### 1. DOM-based XSS

**Material:** DOM sources and sinks, safe DOM construction (pp. 7–14).

**Vulnerable flow:** `client/app.js` reads the `name` query parameter and used
to interpolate it into `app.innerHTML`. A URL is attacker-influenced input;
`innerHTML` asks the browser to parse that input as markup, which can turn text
into executable page content.

**Fix:** The dashboard now creates elements and assigns URL and profile values
through `textContent`/text nodes. The account page follows the same pattern.
The profile is fetched as JSON rather than embedded into generated HTML.

**What to learn:** A source is where untrusted data enters; a sink is where it
is used. Choose a sink whose interpretation matches the requirement. If the
requirement is to display a name, use a text sink rather than an HTML parser.

**Verification:** The DOM test supplies markup in `?name=...` and asserts it
remains a text value and creates no `img` element. The rendered dashboard and
account page continue to show profile details.

### 2. Prototype pollution

**Material:** unsafe merges, special property names, allowlisting (pp. 15–20).

**Vulnerable flow:** Both the old client helper and the settings API copied
arbitrary keys into ordinary objects. The API request body is untrusted JSON;
special keys such as `__proto__`, `constructor`, and `prototype` must not be
blindly assigned.

**Fix:** `server/settings.js` accepts only the known `theme`, `language`, and
`fontSize` properties and validates each against its supported values. Unknown
keys and non-object input are rejected with HTTP 400. The server constructs its
result from fixed defaults and allowlisted values rather than merging
attacker-controlled properties.

**What to learn:** An object merge is not a validation step. `Object.keys`
alone does not make arbitrary assignment safe; constrain both property names
and values. Authentication or authorization decisions should not depend on
unexpected inherited properties.

**Verification:** Tests submit valid settings and confirm they are saved, then
submit a JSON `__proto__` key and confirm it is rejected without changing
`Object.prototype`.

### 3. Content Security Policy (CSP)

**Material:** CSP directives and restrictive policy design (pp. 21–27).

**Vulnerable configuration:** The original server sent no CSP. It also
generated inline scripts and styles, which can pressure a policy into allowing
inline execution.

**Fix:** The server sends a restrictive HTTP CSP: same-origin resources,
`object-src 'none'`, and `frame-ancestors 'none'`, without `unsafe-inline` or
`unsafe-eval`. The page uses external same-origin scripts and styles instead of
inline code.

**What to learn:** CSP is a browser-enforced allowlist for resource loading and
execution. It reduces the impact of mistakes such as XSS, but does not replace
safe DOM APIs or input handling. Configure and test the policy against the
application's real resources.

**Verification:** Tests assert the CSP directives on both pages, verify there
are no inline scripts/styles, and check that same-origin scripts and styles
remain in the HTML. Browser developer tools can be used to inspect any
violations while running the application.

### 4. SSR token leakage

**Material:** server/browser boundaries and data minimization (pp. 28–34).

**Vulnerable flow:** The original root route serialized the complete `user`
object—including session and refresh tokens—into `window.initialUser`.
`/api/profile` also returned the entire object. Anything serialized into HTML
or returned to browser JavaScript crosses the server/browser security boundary
and is no longer server-only.

**Fix:** Profile responses are explicitly projected to `id`, `name`, `email`,
and `role`. The dashboard and account page load this public profile DTO from
`/api/profile`; token fields remain server-side.

**What to learn:** Use data minimization at every server-to-client boundary.
Ask whether each field is needed in the browser, and do not serialize an entire
server record when a small DTO will do. HttpOnly cookies may be appropriate in
a real authentication architecture, but are not a substitute for XSS or CSRF
protections.

**Verification:** Tests check the profile API, dashboard HTML, and account
HTML for the training token values, and assert that the profile response has
only the four intended public fields.

### 5. Clickjacking

**Material:** frame protections and `frame-ancestors` (pp. 34–39).

**Vulnerable configuration:** The account page contains a sensitive-looking
account action and the original application allowed other sites to frame it.
A transparent or disguised frame can make a user click controls they did not
intend to operate.

**Fix:** Every response has `Content-Security-Policy: frame-ancestors 'none'`
and `X-Frame-Options: DENY`, so the dashboard and account page cannot be
embedded by other sites. The headers are sent over HTTP; a meta tag is not an
equivalent defense.

**What to learn:** `frame-ancestors` controls which sites can embed this
application. X-Frame-Options is a compatibility layer. If product requirements
ever need embedding, explicitly allow only trusted origins and retain
server-side authorization for sensitive actions.

**Verification:** Tests assert both anti-framing headers on both pages. Open
`test/iframe-test.html` in a browser while the app is running to observe the
browser blocking the embedded account page.

### Account-page behavior

The account page loads the same minimized profile DTO and displays its fields
as text. Its delete button is a demonstration placeholder that displays a
status message; it does not delete data, matching the starter project's
behavior.

## Defense in depth

The protections work together rather than relying on one filter: the UI uses
safe text sinks; the API validates settings and minimizes profile data; CSP
restricts browser execution and resources; and anti-framing headers prevent
UI-redress attacks. If one layer is missed or later regresses, the other
controls still reduce exposure.

## Assignment completion checklist

- [x] Starter project downloaded, extracted, and opened.
- [x] Dedicated branch created: `samujawar/modern-frontend-security`.
- [x] Original vulnerable starter committed as the first commit.
- [x] All five security areas fixed and documented.
- [x] Positive and negative automated scenarios added.
- [ ] Push the branch and create a Pull Request (requires a configured remote).
- [ ] Record and submit a browser demonstration video (the existing
  `security-demo.mov` is a silent slide-based walkthrough).
- [ ] Send the completion email with the branch and Pull Request link.

The two supplied training PDFs are marked confidential and are intentionally not
included in Git.
