const app = document.getElementById("app");
const params = new URLSearchParams(window.location.search);
const settingOptions = {
    theme: ["light", "dark"],
    language: ["en", "fr"],
    fontSize: ["small", "medium", "large"]
};

function appendText(parent, tagName, className, value) {
    const element = document.createElement(tagName);
    if (className) {
        element.className = className;
    }
    element.textContent = value;
    parent.appendChild(element);
}

function applySettings(settings) {
    if (
        settings === null ||
        typeof settings !== "object" ||
        Array.isArray(settings) ||
        Object.keys(settings).length !== Object.keys(settingOptions).length ||
        Object.keys(settingOptions).some(
            (key) =>
                !Object.hasOwn(settings, key) ||
                !settingOptions[key].includes(settings[key])
        )
    ) {
        throw new Error("The settings response has an invalid shape.");
    }

    document.body.classList.toggle("theme-dark", settings.theme === "dark");
    for (const size of settingOptions.fontSize) {
        document.body.classList.toggle(
            `font-size-${size}`,
            settings.fontSize === size
        );
    }
    document.documentElement.lang = settings.language;
    document.getElementById("theme").value = settings.theme;
    document.getElementById("language").value = settings.language;
    document.getElementById("fontSize").value = settings.fontSize;
}

async function loadSettings() {
    try {
        const response = await fetch("/api/settings");
        if (!response.ok) {
            throw new Error("Settings request failed.");
        }

        applySettings(await response.json());
    } catch (error) {
        console.error("Unable to load settings.", error);
        document.getElementById("settings-status").textContent =
            "Unable to load settings.";
    }
}

async function loadProfile() {
    try {
        const response = await fetch("/api/profile");
        if (!response.ok) {
            throw new Error("Profile request failed.");
        }

        const user = await response.json();
        const username = params.get("name") || user.name || "Guest";
        const profile = document.createElement("section");
        profile.className = "profile-card";
        appendText(profile, "h2", "", `Welcome, ${username}`);

        const email = document.createElement("p");
        email.append("Email: ");
        email.append(document.createTextNode(user.email || "Unknown"));
        profile.appendChild(email);

        const role = document.createElement("p");
        role.append("Role: ");
        role.append(document.createTextNode(user.role || "User"));
        profile.appendChild(role);
        app.replaceChildren(profile);
    } catch (error) {
        console.error("Unable to load the user profile.", error);
        app.textContent = "Unable to load the user profile.";
    }
}

const profileLoad = (async () => {
    await loadSettings();
    await loadProfile();
})();
const saveButton = document.getElementById("save-settings");

saveButton.addEventListener("click", async () => {
    const settings = {
        theme: document.getElementById("theme").value,
        language: document.getElementById("language").value,
        fontSize: document.getElementById("fontSize").value
    };

    try {
        const response = await fetch("/api/settings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(settings)
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Settings request failed.");
        }

        applySettings(result.settings);
        document.getElementById("settings-status").textContent =
            result.message;
    } catch (error) {
        console.error("Unable to save settings.", error);
        document.getElementById("settings-status").textContent =
            "Unable to save settings.";
    }
});
