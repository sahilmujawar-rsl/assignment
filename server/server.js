const express = require("express");
const path = require("path");

const { user, defaultSettings } = require("./data");
const { validateSettings } = require("./settings");

const app = express();
const PORT = 3000;
const clientDirectory = path.join(__dirname, "..", "client");
let currentSettings = { ...defaultSettings };

app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        [
            "default-src 'self'",
            "base-uri 'self'",
            "connect-src 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "img-src 'self'",
            "object-src 'none'",
            "script-src 'self'",
            "style-src 'self'"
        ].join("; ")
    );
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
});

app.use(express.json({ limit: "10kb" }));

app.get("/api/profile", (req, res) => {
    const { id, name, email, role } = user;
    res.json({ id, name, email, role });
});

app.get("/api/settings", (req, res) => {
    res.json({ ...currentSettings });
});

app.post("/api/settings", (req, res) => {
    const result = validateSettings(req.body);

    if (result.error) {
        return res.status(400).json({ message: result.error });
    }

    currentSettings = result.settings;

    return res.json({
        message: "Settings saved successfully.",
        settings: { ...currentSettings }
    });
});

app.get("/account", (req, res) => {
    res.sendFile(path.join(clientDirectory, "account.html"));
});

app.use(express.static(clientDirectory));

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Application running at http://localhost:${PORT}`);
    });
}

module.exports = app;
