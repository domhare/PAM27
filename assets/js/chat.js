/*
 * KI-Assistent (index-1.html)
 * Chat window UI: shows messages, sends questions, renders replies.
 *
 * Gemini anbinden:
 *   Set CHAT_ENDPOINT to a server-side endpoint (e.g. chat.php) that forwards the
 *   conversation to Gemini and answers with JSON { "reply": "..." }.
 *   The request body is { "messages": [ { "role": "user" | "model", "text": "..." } ] }.
 *   Never put the Gemini API key in this file - it would be visible to every visitor.
 */
document.addEventListener("DOMContentLoaded", function () {
    const CHAT_ENDPOINT = "";

    const FALLBACK = "Der Chat-Assistent ist noch nicht verbunden. Rufen Sie uns gerne an: (0821) 455-366-36, " +
        "oder stellen Sie eine Serviceanfrage.";

    const list = document.querySelector("[data-chat-messages]");
    const form = document.querySelector("[data-chat-form]");
    if (!list || !form) return;
    const input = form.querySelector("input");
    const history = [];

    function add(text, role) {
        const msg = document.createElement("div");
        msg.className = "gt-chat-msg " + (role === "user" ? "is-user" : "is-bot");
        msg.textContent = text;
        list.appendChild(msg);
        list.scrollTop = list.scrollHeight;
        return msg;
    }

    // Replace this with the Gemini call if no server endpoint is used
    function askAssistant(messages) {
        if (!CHAT_ENDPOINT) return Promise.resolve(FALLBACK);
        return fetch(CHAT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: messages })
        })
            .then(res => {
                if (!res.ok) throw new Error(res.status);
                return res.json();
            })
            .then(data => data.reply || FALLBACK);
    }

    function send(text) {
        text = text.trim();
        if (!text) return;
        add(text, "user");
        history.push({ role: "user", text: text });
        input.value = "";
        input.disabled = true;

        const typing = add("…", "bot");
        typing.classList.add("is-typing");

        askAssistant(history)
            .catch(() => FALLBACK)
            .then(reply => {
                typing.remove();
                add(reply, "bot");
                history.push({ role: "model", text: reply });
                input.disabled = false;
                input.focus();
            });
    }

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        send(input.value);
    });

    // Example questions next to the chat send themselves
    document.querySelectorAll("[data-chat-ask]").forEach(btn => {
        btn.addEventListener("click", function () {
            send(btn.textContent);
        });
    });
});
