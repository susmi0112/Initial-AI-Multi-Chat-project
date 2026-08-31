const API_URL = "http://127.0.0.1:5000";

const username = localStorage.getItem("username");


if (!username) {

    window.location.href = "index.html";

}


async function sendFeedback() {

    const feedback =
        document.getElementById("feedback").value.trim();

    const message =
        document.getElementById("feedback-message");


    if (!feedback) {

        message.textContent =
            "Please enter your feedback.";

        return;
    }


    try {

        const response = await fetch(
            `${API_URL}/feedback`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    username: username,
                    feedback: feedback
                })
            }
        );


        const data = await response.json();


        message.textContent = data.message;


        if (data.success) {

            document.getElementById("feedback").value = "";

        }

    } catch (error) {

        message.textContent =
            "Cannot connect to server.";

        console.error(error);
    }
}


function backToChat() {

    window.location.href = "chat.html";

}