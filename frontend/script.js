const API_URL = "http://127.0.0.1:5000";


// =========================
// GET ELEMENTS
// =========================

const loginForm =
    document.getElementById("login-form");

const usernameInput =
    document.getElementById("username");

const passwordInput =
    document.getElementById("password");

const message =
    document.getElementById("message");

const loginButton =
    document.getElementById("login-button");

const buttonText =
    document.getElementById("button-text");

const loader =
    document.getElementById("loader");

const togglePassword =
    document.getElementById("toggle-password");


// =========================
// PASSWORD SHOW / HIDE
// =========================

togglePassword.addEventListener(
    "click",
    function () {

        if (passwordInput.type === "password") {

            passwordInput.type = "text";

            togglePassword.textContent = "🙈";

        } else {

            passwordInput.type = "password";

            togglePassword.textContent = "👁";

        }

    }
);


// =========================
// LOGIN
// =========================

loginForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const username =
            usernameInput.value.trim();

        const password =
            passwordInput.value;


        // Clear previous message

        message.textContent = "";

        message.className = "message";


        // Validate

        if (!username || !password) {

            showMessage(
                "Please enter username and password.",
                "error"
            );

            return;

        }


        // Loading state

        loginButton.disabled = true;

        buttonText.style.display = "none";

        loader.style.display = "block";


        try {

            const response =
                await fetch(
                    `${API_URL}/login`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            username: username,
                            password: password
                        })
                    }
                );


            const data =
                await response.json();


            if (data.success) {

                showMessage(
                    "Login successful! Redirecting...",
                    "success"
                );


                // Save username

                localStorage.setItem(
                    "username",
                    username
                );


                // Redirect

                setTimeout(
                    function () {

                        window.location.href =
                            "chat.html";

                    },
                    700
                );


            } else {

                showMessage(
                    data.message ||
                    "Invalid username or password.",
                    "error"
                );

            }


        } catch (error) {

            console.error(
                "Login error:",
                error
            );


            showMessage(
                "Unable to connect to the server.",
                "error"
            );

        }


        // Restore button

        loginButton.disabled = false;

        buttonText.style.display = "inline";

        loader.style.display = "none";

    }
);


// =========================
// SHOW MESSAGE
// =========================

function showMessage(
    text,
    type
) {

    message.textContent = text;

    message.className =
        "message " + type;

}