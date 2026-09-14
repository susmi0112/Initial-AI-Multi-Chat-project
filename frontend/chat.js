const API_URL = "https://initial-ai-multi-chat-project.onrender.com";

let username = localStorage.getItem("username");

let chatBox = null;
let messageInput = null;
let sendButton = null;
let currentRoomId = new URLSearchParams(window.location.search).get("room") || localStorage.getItem("roomId") || "";

let lastMessagesJSON = "";
let isSending = false;
let pollTimer = null;
let conversationRequest = null;
let conversationVersion = 0;
let membersList = null;
let lastMembersJSON = "";

if (!username) {
    window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", function () {
    chatBox = document.getElementById("chat-box");
    messageInput = document.getElementById("user-message");
    sendButton = document.getElementById("send-button");
    membersList = document.getElementById("members-list");

    updateUserDetails();
    updateRoomDetails();
    setupInput();
    loadConversation(false);
    loadMembers(false);

    pollTimer = setInterval(function () {
        if (!isSending) {
            loadConversation(true);
            loadMembers(true);
        }
    }, 3000);
});

function updateRoomDetails() {
    const roomLabel = document.getElementById("current-room-id");

    if (roomLabel) {
        roomLabel.textContent = currentRoomId
            ? "Room ID: " + currentRoomId
            : "";
    }
}

async function openCurrentRoom() {
    if (!currentRoomId) {
        return;
    }

    conversationVersion += 1;
    lastMessagesJSON = "";
    lastMembersJSON = "";
    updateRoomDetails();

    await loadMembers(false);
    await loadConversation(false);
}

async function createRoom() {
    try {
        const response = await fetch(`${API_URL}/create-room`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({username: username})
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            alert(data.message || "Unable to create room.");
            return;
        }

        currentRoomId = data.room.id;
        localStorage.setItem("roomId", currentRoomId);
        conversationVersion += 1;
        updateRoomDetails();
        alert(
            "Room created successfully!\n\nRoom ID: " +
            currentRoomId +
            "\n\nShare this ID with your friends."
        );
        lastMessagesJSON = "";
        lastMembersJSON = "";
        await loadMembers(false);
        await loadConversation(false);
    } catch (error) {
        console.error("Create room error:", error);
        alert("Unable to create room.");
    }
}

async function joinRoom() {
    const roomId = prompt("Enter Room ID:");

    if (!roomId || !roomId.trim()) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/join-room`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                username: username,
                room_id: roomId.trim()
            })
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            alert(data.message || "Room not found.");
            return;
        }

        currentRoomId = data.room.id;
        localStorage.setItem("roomId", currentRoomId);
        conversationVersion += 1;
        updateRoomDetails();
        lastMessagesJSON = "";
        lastMembersJSON = "";
        await loadMembers(false);
        await loadConversation(false);
    } catch (error) {
        console.error("Join room error:", error);
        alert("Unable to join room.");
    }
}
async function loadMembers(silent = false) {
    if (!membersList) {
        return;
    }

    try {
        const membersEndpoint = currentRoomId
            ? `${API_URL}/rooms/${encodeURIComponent(currentRoomId)}/members`
            : `${API_URL}/members`;

        const response = await fetch(membersEndpoint, {
            method: "GET",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Members request failed: " + response.status);
        }

        const data = await response.json();
        let members = [];

        if (Array.isArray(data)) {
            members = data;
        } else if (Array.isArray(data.members)) {
            members = data.members;
        } else if (Array.isArray(data.users)) {
            members = data.users;
        }

        members = members.map(function (member) {
            if (typeof member === "string") {
                return member;
            }

            return member.username || member.name || "";
        }).filter(Boolean);

        if (username && !members.includes(username)) {
            members.push(username);
        }

        members = [...new Set(members)].filter(function (member) {
            return member.toLowerCase() !== "ai assistant";
        });

        const currentMembersJSON = JSON.stringify(members);

        if (currentMembersJSON === lastMembersJSON) {
            return;
        }

        lastMembersJSON = currentMembersJSON;
        renderMembers(members);
    } catch (error) {
        console.error("Unable to load members:", error);

        if (!silent) {
            console.warn("Unable to load chat members.");
        }
    }
}

function renderMembers(members) {
    const existingMembers = membersList.querySelectorAll(".member");

    Array.from(existingMembers).slice(1).forEach(function (member) {
        member.remove();
    });

    members.forEach(function (member) {
        const memberElement = document.createElement("div");

        const avatar = document.createElement("div");
        avatar.className = "member-avatar user-avatar";
        avatar.textContent = "👤";

        const info = document.createElement("div");
        info.className = "member-info";

        const name = document.createElement("strong");
        name.textContent = member;

        const status = document.createElement("span");
        const statusDot = document.createElement("i");
        statusDot.className = "status-dot";
        status.appendChild(statusDot);
        status.appendChild(document.createTextNode("Online"));

        info.appendChild(name);
        info.appendChild(status);
        memberElement.appendChild(avatar);
        memberElement.appendChild(info);
        membersList.appendChild(memberElement);
    });
}

function updateUserDetails() {
    const sidebarUsername = document.getElementById("sidebar-username");
    const welcome = document.getElementById("welcome");

    if (sidebarUsername) {
        sidebarUsername.textContent = username;
    }

    if (welcome) {
        welcome.textContent = "Logged in as: " + username;
    }
}

async function loadConversation(silent = false) {
    if (!username || !chatBox) {
        return;
    }

    if (conversationRequest) {
        return conversationRequest;
    }

    const requestVersion = conversationVersion;
    const conversationEndpoint = currentRoomId
        ? `${API_URL}/conversation/${encodeURIComponent(currentRoomId)}?username=${encodeURIComponent(username)}`
        : `${API_URL}/conversation/${encodeURIComponent(username)}`;

    conversationRequest = fetch(
        conversationEndpoint,
        {
            method: "GET",
            cache: "no-store"
        }
    ).then(async function (response) {
        if (!response.ok) {
            throw new Error(
                "Conversation request failed: " + response.status
            );
        }

        const data = await response.json();
        if (requestVersion !== conversationVersion) {
            return;
        }

        let messages = [];

        if (Array.isArray(data.messages)) {
            messages = data.messages;
        } else if (Array.isArray(data)) {
            messages = data;
        } else if (Array.isArray(data.conversation)) {
            messages = data.conversation;
        }

        const currentMessagesJSON = JSON.stringify(messages);

        if (currentMessagesJSON === lastMessagesJSON) {
            return;
        }

        lastMessagesJSON = currentMessagesJSON;
        renderMessages(messages);
    }).catch(function (error) {
        console.error("Unable to load conversation:", error);

        if (!silent) {
            console.warn("Backend is not responding.");
        }
    }).finally(function () {
        conversationRequest = null;
    });

    return conversationRequest;
}


function renderMessages(messages) {

    if (!chatBox) {
        return;
    }

    const distanceFromBottom =
        chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight;

    const wasNearBottom = distanceFromBottom < 150;

    if (!messages || messages.length === 0) {
        chatBox.innerHTML = `
            <div class="empty-chat">
                <div class="empty-icon">🤖</div>
                <h2>Welcome to AI Multi-Chat!</h2>
                <p>Chat with your friends and AI in one shared conversation.</p>
                <div class="suggestions">
                    <button type="button" onclick="useSuggestion('What is Artificial Intelligence?')">
                        💡 What is Artificial Intelligence?
                    </button>
                    <button type="button" onclick="useSuggestion('Explain Python')">
                        🐍 Explain Python
                    </button>
                    <button type="button" onclick="useSuggestion('Give me a project idea')">
                        🚀 Give me a project idea
                    </button>
                </div>
            </div>
        `;
        return;
    }

    const fragment =
        document.createDocumentFragment();


    messages.forEach(function (message) {

        const element =
            createMessageElement(message);


        if (element) {

            fragment.appendChild(
                element
            );

        }

    });


    /*
     * Replace chat messages only when
     * the data has actually changed.
     *
     * Input box is outside chatBox,
     * so typing will not be interrupted.
     */

    chatBox.replaceChildren(
        fragment
    );


    // =================================================
    // SCROLL
    // =================================================

    if (wasNearBottom) {

        requestAnimationFrame(
            function () {

                chatBox.scrollTop =
                    chatBox.scrollHeight;

            }
        );

    }
}


// =====================================================
// CREATE MESSAGE
// =====================================================

function createMessageElement(message) {

    if (!message) {
        return null;
    }


    const sender =
        message.sender ||
        message.username ||
        message.user ||
        message.role ||
        "User";


    const text =
        message.message ||
        message.content ||
        message.text ||
        "";


    const timestamp =
        message.timestamp ||
        message.time ||
        "";


    if (!text) {
        return null;
    }


    const senderName =
        String(sender);


    const lowerSender =
        senderName.toLowerCase();


    // =================================================
    // AI MESSAGE
    // =================================================

    const isAI =
        lowerSender === "ai" ||
        lowerSender === "assistant" ||
        lowerSender.includes(
            "ai assistant"
        );


    // =================================================
    // CURRENT USER
    // =================================================

    const isCurrentUser =
        lowerSender ===
        String(username).toLowerCase();


    // =================================================
    // MESSAGE ROW
    // =================================================

    const row =
        document.createElement("div");


    if (isAI) {

        row.className =
            "message-row ai-message-row";

    }

    else if (isCurrentUser) {

        row.className =
            "message-row user-message-row";

    }

    else {

        row.className =
            "message-row other-message-row";

    }


    // =================================================
    // AVATAR
    // =================================================

    const avatar =
        document.createElement("div");


    avatar.className =
        isAI
            ? "message-avatar ai-avatar"
            : "message-avatar user-avatar";


    avatar.textContent =
        isAI
            ? "🤖"
            : "👤";


    // =================================================
    // CONTENT
    // =================================================

    const content =
        document.createElement("div");


    content.className =
        "message-content";


    // =================================================
    // SENDER
    // =================================================

    const senderElement =
        document.createElement("div");


    senderElement.className =
        "message-sender";


    if (isAI) {

        senderElement.textContent =
            "AI Assistant";

    }

    else if (isCurrentUser) {

        senderElement.textContent =
            "You";

    }

    else {

        senderElement.textContent =
            senderName;

    }


    // =================================================
    // MESSAGE BUBBLE
    // =================================================

    const bubble =
        document.createElement("div");


    bubble.className =
        "message-bubble";


    /*
     * textContent prevents HTML injection.
     */

    bubble.textContent =
        text;


    // =================================================
    // TIME
    // =================================================

    content.appendChild(
        senderElement
    );


    content.appendChild(
        bubble
    );


    if (timestamp) {

        const timeElement =
            document.createElement("div");


        timeElement.className =
            "message-time";


        timeElement.textContent =
            formatTime(timestamp);


        content.appendChild(
            timeElement
        );

    }


    // =================================================
    // ADD ELEMENTS
    // =================================================

    row.appendChild(
        avatar
    );


    row.appendChild(
        content
    );


    return row;
}


// =====================================================
// FORMAT TIME
// =====================================================

function formatTime(value) {

    if (!value) {
        return "";
    }


    try {

        const date =
            new Date(value);


        if (
            isNaN(
                date.getTime()
            )
        ) {

            return value;

        }


        return date.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    }

    catch (error) {

        return value;

    }
}


// =====================================================
// SEND MESSAGE
// =====================================================

async function sendMessage() {

    if (isSending) {
        return;
    }


    if (!messageInput) {
        return;
    }


    const text =
        messageInput.value.trim();


    if (!text) {
        return;
    }


    isSending = true;
    conversationVersion += 1;


    if (sendButton) {

        sendButton.disabled =
            true;

    }


    /*
     * Save message before clearing.
     */

    const oldText =
        text;


    /*
     * Clear input immediately.
     */

    messageInput.value = "";

    autoResize();


    /*
     * Show the user's message immediately.
     *
     * This gives a fast UI response.
     */

    addTemporaryMessage(
        "user",
        oldText
    );


    /*
     * Show AI thinking indicator.
     */

    showThinking();


    try {

        const response =
            await fetch(
                `${API_URL}/message`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            username:
                                username,

                            message:
                                oldText,

                            room_id:
                                currentRoomId
                        })
                }
            );


        if (!response.ok) {

            throw new Error(
                "Message request failed: " +
                response.status
            );

        }


        const data =
            await response.json();


        console.log(
            "Message response:",
            data
        );


        /*
         * Remove thinking indicator.
         */

        hideThinking();


        /*
         * Force conversation reload.
         */

        lastMessagesJSON =
            "";


        await loadConversation(false);

    }

    catch (error) {

        console.error(
            "Send error:",
            error
        );


        hideThinking();


        /*
         * Restore message if failed.
         */

        messageInput.value =
            oldText;


        autoResize();


        alert(
            "Unable to connect to the AI server.\n\n" +
            "Make sure backend/app.py is running."
        );

    }

    finally {

        isSending =
            false;


        if (sendButton) {

            sendButton.disabled =
                false;

        }


        messageInput.focus();

    }
}


// =====================================================
// TEMPORARY USER MESSAGE
// =====================================================

function addTemporaryMessage(
    sender,
    text
) {

    if (!chatBox) {
        return;
    }


    /*
     * Remove empty screen if present.
     */

    const emptyChat =
        chatBox.querySelector(
            ".empty-chat"
        );


    if (emptyChat) {

        emptyChat.remove();

    }


    const row =
        document.createElement(
            "div"
        );


    row.className =
        "message-row user-message-row";


    const avatar =
        document.createElement(
            "div"
        );


    avatar.className =
        "message-avatar user-avatar";


    avatar.textContent =
        "👤";


    const content =
        document.createElement(
            "div"
        );


    content.className =
        "message-content";


    const senderElement =
        document.createElement(
            "div"
        );


    senderElement.className =
        "message-sender";


    senderElement.textContent =
        "You";


    const bubble =
        document.createElement(
            "div"
        );


    bubble.className =
        "message-bubble";


    bubble.textContent =
        text;


    content.appendChild(
        senderElement
    );


    content.appendChild(
        bubble
    );


    row.appendChild(
        avatar
    );


    row.appendChild(
        content
    );


    chatBox.appendChild(
        row
    );


    chatBox.scrollTop =
        chatBox.scrollHeight;
}


// =====================================================
// AI THINKING
// =====================================================

function showThinking() {

    if (!chatBox) {
        return;
    }


    /*
     * Do not create two indicators.
     */

    if (
        document.getElementById(
            "thinking-indicator"
        )
    ) {

        return;

    }


    const thinking =
        document.createElement(
            "div"
        );


    thinking.id =
        "thinking-indicator";


    thinking.className =
        "message-row ai-message-row";


    thinking.innerHTML = `

        <div class="message-avatar ai-avatar">
            🤖
        </div>

        <div class="message-content">

            <div class="message-sender">
                AI Assistant
            </div>

            <div class="message-bubble thinking-bubble">

                <span>AI is thinking</span>

                <span class="thinking-dots">
                    <i></i>
                    <i></i>
                    <i></i>
                </span>

            </div>

        </div>

    `;


    chatBox.appendChild(
        thinking
    );


    chatBox.scrollTop =
        chatBox.scrollHeight;
}


// =====================================================
// REMOVE THINKING
// =====================================================

function hideThinking() {

    const thinking =
        document.getElementById(
            "thinking-indicator"
        );


    if (thinking) {

        thinking.remove();

    }
}


// =====================================================
// INPUT SETUP
// =====================================================

function setupInput() {

    if (!messageInput) {
        return;
    }


    /*
     * ENTER = SEND
     *
     * SHIFT + ENTER = NEW LINE
     */

    messageInput.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();

            }

        }
    );


    /*
     * Auto resize.
     */

    messageInput.addEventListener(
        "input",
        autoResize
    );


    /*
     * IMPORTANT:
     *
     * Your chat.html already has:
     *
     * onclick="sendMessage()"
     *
     * Therefore we DO NOT add another
     * click event listener here.
     */

}


// =====================================================
// AUTO RESIZE
// =====================================================

function autoResize() {

    if (!messageInput) {
        return;
    }


    messageInput.style.height =
        "auto";


    messageInput.style.height =
        Math.min(
            messageInput.scrollHeight,
            140
        ) + "px";
}


// =====================================================
// SUGGESTION
// =====================================================

function useSuggestion(text) {

    if (!messageInput) {
        return;
    }


    messageInput.value =
        text;


    autoResize();


    messageInput.focus();

}


// =====================================================
// NEW CHAT
// =====================================================

function newChat() {

    if (!chatBox) {
        return;
    }


    /*
     * IMPORTANT:
     *
     * This does NOT delete the shared conversation.
     *
     * It only displays a new-chat screen.
     */


    chatBox.innerHTML = `

        <div class="empty-chat">

            <div class="empty-icon">
                🤖
            </div>

            <h2>
                New conversation
            </h2>

            <p>
                Start a new conversation
                with your friends and AI.
            </p>

        </div>

    `;


    /*
     * Force next server update.
     */

    lastMessagesJSON =
        "";


    if (messageInput) {

        messageInput.focus();

    }
}


// =====================================================
// FEEDBACK
// =====================================================

function openFeedback() {

    const feedback =
        prompt(
            "Enter your feedback:"
        );


    if (!feedback) {
        return;
    }


    fetch(
        `${API_URL}/feedback`,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body:
                JSON.stringify({
                    username:
                        username,

                    feedback:
                        feedback
                })
        }
    )

    .then(function (response) {

        if (response.ok) {

            alert(
                "Thank you for your feedback!"
            );

        }

        else {

            alert(
                "Unable to submit feedback."
            );

        }

    })

    .catch(function (error) {

        console.error(
            "Feedback error:",
            error
        );


        alert(
            "Unable to connect to the server."
        );

    });

}


// =====================================================
// LOGOUT
// =====================================================

function logout() {

    /*
     * Stop polling before leaving page.
     */

    if (pollTimer) {

        clearInterval(
            pollTimer
        );

        pollTimer =
            null;

    }


    localStorage.removeItem(
        "username"
    );


    window.location.href =
        "index.html";
}