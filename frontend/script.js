"use strict";

const API_BASE = "";
const STORAGE_KEY = "abcRideCurrentChatId";
const MAX_INPUT_HEIGHT = 180;
const MOBILE_QUERY = "(max-width: 760px)";

/* ---------- DOM references (all guarded) ---------- */

const chatHistory = document.getElementById("chatHistory");
const newChatBtn = document.getElementById("newChatBtn");
const messagesContainer = document.getElementById("messages");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const chatArea = document.getElementById("chatArea");
const sidebar = document.getElementById("sidebar");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const menuBtn = document.getElementById("menuBtn");
const closeSidebarBtn = document.getElementById("closeSidebar");
const onlineStatus = document.getElementById("onlineStatus");
const statusText = document.getElementById("statusText");

/* ---------- State ---------- */

let currentChatId = null;
let isSending = false;
let chats = [];
let openRequestToken = 0; // guards against stale responses when switching chats

/* ---------- Storage helpers (may throw in private modes) ---------- */

function storageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch (_) {
        return null;
    }
}

function storageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (_) { /* ignore */ }
}

function storageRemove(key) {
    try {
        localStorage.removeItem(key);
    } catch (_) { /* ignore */ }
}

/* ---------- API ---------- */

async function apiRequest(url, options = {}) {
    const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Request failed: ${response.status}`);
    }

    return response.json();
}

function chatIdOf(chat) {
    return chat ? (chat.chat_id || chat.id) : null;
}

/* ---------- Icons (safe DOM construction) ---------- */

const SVG_NS = "http://www.w3.org/2000/svg";

function createAvatarIcon() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");

    const paths = [
        "M5 16V11l1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11v5",
        "M3.5 16h17v2.2a.8.8 0 0 1-.8.8H18a.8.8 0 0 1-.8-.8V17.5H6.8v.7a.8.8 0 0 1-.8.8H4.3a.8.8 0 0 1-.8-.8V16z"
    ];

    paths.forEach(d => {
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", d);
        svg.appendChild(path);
    });

    return svg;
}

/* ---------- Sidebar drawer ---------- */

function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.add("open");
    if (sidebarBackdrop) sidebarBackdrop.classList.add("visible");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove("open");
    if (sidebarBackdrop) sidebarBackdrop.classList.remove("visible");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
}

/* ---------- Scrolling ---------- */

function isNearBottom(threshold = 140) {
    if (!chatArea) return true;
    return (
        chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight
        < threshold
    );
}

function scrollToBottom(smooth = false) {
    if (!chatArea) return;
    chatArea.scrollTo({
        top: chatArea.scrollHeight,
        behavior: smooth ? "smooth" : "auto"
    });
}

/* ---------- Composer state ---------- */

function updateSendButton() {
    if (!sendBtn || !messageInput) return;
    const hasText = messageInput.value.trim().length > 0;
    sendBtn.disabled = isSending || !hasText;
}

function resizeInput() {
    if (!messageInput) return;
    messageInput.style.height = "auto";
    messageInput.style.height =
        `${Math.min(messageInput.scrollHeight, MAX_INPUT_HEIGHT)}px`;
}

function setSendingState(sending) {
    isSending = sending;

    if (messageForm) messageForm.classList.toggle("is-loading", sending);
    if (messageInput) messageInput.readOnly = sending;
    if (messageForm) messageForm.setAttribute("aria-busy", String(sending));

    updateSendButton();
}

/* ---------- Messages ---------- */

function addMessage(role, content, options = {}) {
    if (!messagesContainer) return null;

    const isUser = role === "user";

    const message = document.createElement("div");
    message.className = `message ${isUser ? "user" : "assistant"}`;
    if (options.error) message.classList.add("error");

    if (!isUser) {
        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.setAttribute("aria-hidden", "true");
        avatar.appendChild(createAvatarIcon());
        message.appendChild(avatar);
    }

    const messageContent = document.createElement("div");
    messageContent.className = "message-content";

    // textContent keeps untrusted text from being parsed as HTML;
    // CSS white-space: pre-wrap preserves newlines.
    messageContent.textContent = String(content ?? "");

    message.appendChild(messageContent);
    messagesContainer.appendChild(message);

    return message;
}

function showTypingIndicator() {
    const message = addMessage("assistant", "");
    if (!message) return null;

    message.classList.add("typing-indicator");
    message.setAttribute("role", "status");
    message.setAttribute("aria-label", "Assistant is typing");

    const content = message.querySelector(".message-content");
    if (content) {
        const dots = document.createElement("span");
        dots.className = "typing-dots";
        for (let i = 0; i < 3; i += 1) {
            dots.appendChild(document.createElement("span"));
        }
        content.appendChild(dots);
    }

    return message;
}

/* ---------- Chat history ---------- */

function setHistoryMessage(text) {
    if (!chatHistory) return;
    chatHistory.replaceChildren();

    const note = document.createElement("p");
    note.className = "history-empty";
    note.textContent = text;
    chatHistory.appendChild(note);
}

function renderChatHistory() {
    if (!chatHistory) return;

    if (chats.length === 0) {
        setHistoryMessage("Your chats will appear here.");
        return;
    }

    chatHistory.replaceChildren();

    chats.forEach(chat => {
        const id = chatIdOf(chat);
        if (!id) return;

        const item = document.createElement("button");
        item.type = "button";
        item.className = "chat-history-item";
        item.dataset.chatId = id;

        const title = document.createElement("span");
        title.className = "chat-history-title";
        title.textContent = chat.title || "New conversation";
        item.title = title.textContent;

        if (String(id) === String(currentChatId)) {
            item.classList.add("active");
            item.setAttribute("aria-current", "true");
        }

        item.appendChild(title);
        item.addEventListener("click", () => openChat(id));

        chatHistory.appendChild(item);
    });
}

async function loadChatHistory() {
    try {
        const data = await apiRequest("/chats");

        chats = Array.isArray(data) ? data : ((data && data.chats) || []);
        renderChatHistory();
    } catch (error) {
        console.error("Unable to load chat history:", error);
        setHistoryMessage("Could not load chat history.");
    }
}

/* ---------- Conversation actions ---------- */

function startNewChat() {
    if (isSending) return;

    openRequestToken += 1; // invalidate any in-flight chat load
    currentChatId = null;

    if (messagesContainer) messagesContainer.replaceChildren();

    if (messageInput) {
        messageInput.value = "";
        resizeInput();
    }
    updateSendButton();

    storageRemove(STORAGE_KEY);
    renderChatHistory();
    closeSidebar();

    if (messageInput) messageInput.focus();
}

async function openChat(chatId) {
    if (isSending) return;
    if (String(chatId) === String(currentChatId) &&
        messagesContainer && messagesContainer.children.length > 0) {
        closeSidebar();
        return;
    }

    const token = ++openRequestToken;

    currentChatId = chatId;
    storageSet(STORAGE_KEY, chatId);

    if (messagesContainer) messagesContainer.replaceChildren();
    renderChatHistory();
    closeSidebar();

    try {
        const data = await apiRequest(
            `/chats/${encodeURIComponent(chatId)}/messages`
        );

        if (token !== openRequestToken) return; // user switched chats meanwhile

        const messages = Array.isArray(data)
            ? data
            : ((data && data.messages) || []);

        if (messagesContainer) messagesContainer.replaceChildren();

        messages.forEach(message => {
            addMessage(message.role, message.content);
        });

        scrollToBottom();
    } catch (error) {
        if (token !== openRequestToken) return;

        console.error("Unable to open conversation:", error);

        addMessage(
            "assistant",
            "Sorry, I could not load this conversation. Please try again.",
            { error: true }
        );
    }
}

async function sendMessage(text) {
    const messageText = String(text || "").trim();

    if (!messageText || isSending) return;

    setSendingState(true);

    addMessage("user", messageText);

    if (messageInput) {
        messageInput.value = "";
        resizeInput();
    }

    const typingMessage = showTypingIndicator();
    scrollToBottom(true);

    // Remember which chat this request belongs to so that a response is
    // never rendered into a different conversation.
    const requestToken = openRequestToken;

    try {
        const payload = { message: messageText };

        if (currentChatId) {
            payload.chat_id = currentChatId;
        }

        const data = await apiRequest("/chat", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        if (typingMessage) typingMessage.remove();

        if (data && data.chat_id) {
            currentChatId = data.chat_id;
            storageSet(STORAGE_KEY, currentChatId);
        }

        if (requestToken === openRequestToken) {
            const answer = data && typeof data.answer === "string"
                ? data.answer.trim()
                : "";

            if (answer) {
                addMessage("assistant", answer);
            } else {
                addMessage(
                    "assistant",
                    "I couldn't generate a response. Please try again.",
                    { error: true }
                );
            }
        }

        await loadChatHistory();
    } catch (error) {
        console.error("Message request failed:", error);

        if (typingMessage) typingMessage.remove();

        addMessage(
            "assistant",
            "Sorry, something went wrong while connecting to the server. Please try again.",
            { error: true }
        );
    } finally {
        setSendingState(false);
        scrollToBottom(true);

        if (messageInput && !window.matchMedia(MOBILE_QUERY).matches) {
            messageInput.focus();
        }
    }
}

/* ---------- Backend status (uses existing GET /health) ---------- */

async function checkHealth() {
    if (!onlineStatus) return;

    try {
        const response = await fetch(`${API_BASE}/health`, { cache: "no-store" });
        const online = response.ok;

        onlineStatus.dataset.state = online ? "online" : "offline";
        if (statusText) {
            statusText.textContent = online ? "AI Assistant" : "Offline";
        }
    } catch (_) {
        onlineStatus.dataset.state = "offline";
        if (statusText) statusText.textContent = "Offline";
    }
}

/* ---------- Event listeners ---------- */

if (messageForm) {
    messageForm.addEventListener("submit", event => {
        event.preventDefault();
        if (messageInput) sendMessage(messageInput.value);
    });
}

if (messageInput) {
    // Enter sends; Shift+Enter inserts a newline (ignored while composing IME text)
    messageInput.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            if (messageForm) messageForm.requestSubmit();
        }
    });

    messageInput.addEventListener("input", () => {
        resizeInput();
        updateSendButton();
    });
}

if (newChatBtn) newChatBtn.addEventListener("click", startNewChat);
if (menuBtn) menuBtn.addEventListener("click", openSidebar);
if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", closeSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener("click", closeSidebar);

document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSidebar();
});

// Reset the drawer when moving back to a desktop-sized viewport
window.matchMedia(MOBILE_QUERY).addEventListener("change", event => {
    if (!event.matches) closeSidebar();
});

/* ---------- Initial load ---------- */

async function initializeChatbot() {
    updateSendButton();
    checkHealth();

    await loadChatHistory();

    const savedChatId = storageGet(STORAGE_KEY);

    if (savedChatId) {
        const chatExists = chats.some(
            chat => String(chatIdOf(chat)) === String(savedChatId)
        );

        if (chatExists) {
            await openChat(savedChatId);
        } else {
            storageRemove(STORAGE_KEY);
        }
    }
}

initializeChatbot();
