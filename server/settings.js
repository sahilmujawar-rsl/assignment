const defaultSettings = {
    theme: "light",
    language: "en",
    fontSize: "medium"
};

const allowedValues = {
    theme: new Set(["light", "dark"]),
    language: new Set(["en", "fr"]),
    fontSize: new Set(["small", "medium", "large"])
};

function validateSettings(input) {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
        return { error: "Settings must be a JSON object." };
    }

    const settings = { ...defaultSettings };

    for (const key of Object.keys(input)) {
        if (!Object.hasOwn(allowedValues, key)) {
            return { error: `Unsupported setting: ${key}` };
        }

        const value = input[key];
        if (typeof value !== "string" || !allowedValues[key].has(value)) {
            return { error: `Invalid value for setting: ${key}` };
        }

        settings[key] = value;
    }

    return { settings };
}

module.exports = { validateSettings };
