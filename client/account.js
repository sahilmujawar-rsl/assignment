async function loadAccount() {
    try {
        const response = await fetch("/api/profile");
        if (!response.ok) {
            throw new Error("Profile request failed.");
        }

        const user = await response.json();
        document.getElementById("account-name").textContent = user.name;
        document.getElementById("account-email").textContent = user.email;
        document.getElementById("account-role").textContent = user.role;
    } catch (error) {
        console.error("Unable to load account details.", error);
        document.getElementById("account-status").textContent =
            "Unable to load account details.";
    }
}

loadAccount();

document.getElementById("delete-account").addEventListener("click", () => {
    document.getElementById("account-status").textContent =
        "Account deletion action triggered.";
});
