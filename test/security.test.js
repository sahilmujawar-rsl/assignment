const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const app = require("../server/server");

let server;
let origin;

test.before(async () => {
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
});

test("DOM XSS and settings: URL text stays inert and preferences apply", async () => {
    class MockElement {
        constructor(tagName = "") {
            this.tagName = tagName;
            this.children = [];
            this.listeners = {};
            this.className = "";
            this.value = "";
            this.textContent = "";
            this.classes = new Set();
            this.classList = {
                toggle: (name, enabled) => {
                    if (enabled) {
                        this.classes.add(name);
                    } else {
                        this.classes.delete(name);
                    }
                },
                contains: (name) => this.classes.has(name)
            };
        }

        appendChild(child) {
            this.children.push(child);
            return child;
        }

        append(...children) {
            this.children.push(...children);
        }

        replaceChildren(...children) {
            this.children = children;
        }

        addEventListener(type, handler) {
            this.listeners[type] = handler;
        }

        set innerHTML(value) {
            throw new Error(`Unsafe innerHTML assignment: ${value}`);
        }
    }

    const appRoot = new MockElement("div");
    const body = new MockElement("body");
    const elements = new Map([
        ["app", appRoot],
        ["save-settings", new MockElement("button")],
        ["theme", new MockElement("select")],
        ["language", new MockElement("select")],
        ["fontSize", new MockElement("select")],
        ["settings-status", new MockElement("p")]
    ]);
    const document = {
        getElementById: (id) => elements.get(id),
        createElement: (tagName) => new MockElement(tagName),
        createTextNode: (text) => ({ textContent: text }),
        body,
        documentElement: { lang: "en" }
    };
    const attackText = '<img src=x onerror="alert(1)">';
    const context = {
        document,
        window: { location: { search: `?name=${encodeURIComponent(attackText)}` } },
        URLSearchParams,
        fetch: async (url, options = {}) => {
            if (url === "/api/settings" && options.method === "POST") {
                return {
                    ok: true,
                    json: async () => ({
                        message: "Settings saved successfully.",
                        settings: JSON.parse(options.body)
                    })
                };
            }

            if (url === "/api/settings") {
                return {
                    ok: true,
                    json: async () => ({
                        theme: "dark",
                        language: "fr",
                        fontSize: "large"
                    })
                };
            }

            return {
                ok: true,
                json: async () => ({
                    name: "Sahil Mujawar",
                    email: "sahil.mujawar@rajasoftwarelabs.com",
                    role: "Administrator"
                })
            };
        }
    };
    const source = fs.readFileSync(
        path.join(__dirname, "..", "client", "app.js"),
        "utf8"
    );
    const profileLoad = vm.runInNewContext(`${source}\nprofileLoad;`, context);

    await profileLoad;

    const heading = appRoot.children[0].children.find(
        (element) => element.tagName === "h2"
    );
    assert.equal(heading.textContent, `Welcome, ${attackText}`);
    assert.equal(
        appRoot.children[0].children.some((element) => element.tagName === "img"),
        false
    );
    assert.equal(body.classList.contains("theme-dark"), true);
    assert.equal(body.classList.contains("font-size-large"), true);
    assert.equal(document.documentElement.lang, "fr");
    assert.equal(elements.get("theme").value, "dark");
    assert.equal(elements.get("language").value, "fr");
    assert.equal(elements.get("fontSize").value, "large");

    elements.get("theme").value = "light";
    elements.get("language").value = "en";
    elements.get("fontSize").value = "small";
    await elements.get("save-settings").listeners.click();

    assert.equal(body.classList.contains("theme-dark"), false);
    assert.equal(body.classList.contains("font-size-small"), true);
    assert.equal(document.documentElement.lang, "en");
    assert.equal(
        elements.get("settings-status").textContent,
        "Settings saved successfully."
    );
});

test("prototype pollution: accepts known settings and rejects unknown keys", async () => {
    const validResponse = await fetch(`${origin}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: "dark", language: "fr", fontSize: "large" })
    });
    assert.equal(validResponse.status, 200);
    assert.deepEqual((await validResponse.json()).settings, {
        theme: "dark",
        language: "fr",
        fontSize: "large"
    });

    const savedResponse = await fetch(`${origin}/api/settings`);
    assert.equal(savedResponse.status, 200);
    assert.deepEqual(await savedResponse.json(), {
        theme: "dark",
        language: "fr",
        fontSize: "large"
    });

    const maliciousInput = JSON.stringify({
        ["__proto__"]: { polluted: true }
    });
    const invalidResponse = await fetch(`${origin}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: maliciousInput
    });
    assert.equal(invalidResponse.status, 400);
    assert.equal(Object.prototype.polluted, undefined);
    const unchangedResponse = await fetch(`${origin}/api/settings`);
    assert.deepEqual(await unchangedResponse.json(), {
        theme: "dark",
        language: "fr",
        fontSize: "large"
    });
});

test("SSR data minimization: profile and HTML responses omit server tokens", async () => {
    const responses = await Promise.all([
        fetch(`${origin}/api/profile`),
        fetch(`${origin}/`),
        fetch(`${origin}/account`)
    ]);
    const bodies = await Promise.all(responses.map((response) => response.text()));

    for (const body of bodies) {
        assert.equal(body.includes("TRAINING-FAKE-ACCESS-TOKEN"), false);
        assert.equal(body.includes("TRAINING-FAKE-REFRESH-TOKEN"), false);
    }

    const profile = JSON.parse(bodies[0]);
    assert.deepEqual(Object.keys(profile).sort(), ["email", "id", "name", "role"]);
    assert.equal(profile.name, "Sahil Mujawar");
    assert.equal(profile.email, "sahil.mujawar@rajasoftwarelabs.com");
});

test("account page: renders profile text and preserves delete status behavior", async () => {
    class MockElement {
        constructor() {
            this.textContent = "";
            this.listeners = {};
        }

        addEventListener(type, handler) {
            this.listeners[type] = handler;
        }
    }

    const elements = new Map(
        ["account-name", "account-email", "account-role", "account-status", "delete-account"]
            .map((id) => [id, new MockElement()])
    );
    const context = {
        document: { getElementById: (id) => elements.get(id) },
        fetch: async () => ({
            ok: true,
            json: async () => ({
                name: "<img src=x>",
                email: "sahil.mujawar@rajasoftwarelabs.com",
                role: "Administrator"
            })
        }),
        console
    };
    const source = fs.readFileSync(
        path.join(__dirname, "..", "client", "account.js"),
        "utf8"
    );
    const loadAccount = vm.runInNewContext(
        `${source}\nloadAccount;`,
        context
    );

    await loadAccount();
    assert.equal(elements.get("account-name").textContent, "<img src=x>");
    assert.equal(
        elements.get("account-email").textContent,
        "sahil.mujawar@rajasoftwarelabs.com"
    );
    assert.equal(elements.get("account-role").textContent, "Administrator");

    elements.get("delete-account").listeners.click();
    assert.equal(
        elements.get("account-status").textContent,
        "Account deletion action triggered."
    );
});

test("CSP: allows same-origin assets without inline execution", async () => {
    for (const page of ["/", "/account"]) {
        const response = await fetch(`${origin}${page}`);
        const policy = response.headers.get("content-security-policy");
        const body = await response.text();

        assert.match(policy, /script-src 'self'/);
        assert.match(policy, /object-src 'none'/);
        assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/);
        assert.doesNotMatch(body, /<script(?![^>]*\bsrc=)[^>]*>/i);
        assert.doesNotMatch(body, /<style\b/i);
    }
});

test("clickjacking: sensitive pages cannot be framed", async () => {
    for (const page of ["/", "/account"]) {
        const response = await fetch(`${origin}${page}`);
        const policy = response.headers.get("content-security-policy");

        assert.match(policy, /frame-ancestors 'none'/);
        assert.equal(response.headers.get("x-frame-options"), "DENY");
    }
});
