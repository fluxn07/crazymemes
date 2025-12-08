import dotenv from "dotenv";
dotenv.config();

import express from "express";
import TelegramBot from "node-telegram-bot-api";

const token = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

// Initialize telegram bot (Long Polling)
const bot = new TelegramBot(token, { polling: true });

// ----------------------
// USERS STORAGE (Example)
// ----------------------
let memes = []; // { id, url, uploadedAt }
let userSessions = {}; // user scrolling positions
const MEME_LIFETIME = 30 * 24 * 60 * 60 * 1000; // 30 days

// Auto delete old memes every 1 hour
setInterval(() => {
    memes = memes.filter(m => Date.now() - m.uploadedAt < MEME_LIFETIME);
}, 3600000);

// ----------------------
// BOT COMMANDS
// ----------------------

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(
        chatId,
        "🔥 Welcome to CrazMemeBot!\n\nScroll fresh memes uploaded by admin 👇\nSend: **next** to get a meme."
    );
});

// Handle scrolling
bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.toLowerCase();

    if (text === "next") {
        if (memes.length === 0) {
            bot.sendMessage(chatId, "😢 No memes found. Admin will upload soon!");
            return;
        }

        // Setup user scroll pos
        if (!userSessions[chatId]) userSessions[chatId] = 0;

        const index = userSessions[chatId];

        // Send meme
        bot.sendPhoto(chatId, memes[index].url);

        // Move to next
        userSessions[chatId] = (index + 1) % memes.length;

        return;
    }
});

// ----------------------
// ADMIN MEME UPLOAD API
// ----------------------

app.post("/upload", (req, res) => {
    const { url, key } = req.body;

    // simple admin key
    if (key !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: "Invalid admin key." });
    }

    memes.push({
        id: memes.length + 1,
        url,
        uploadedAt: Date.now()
    });

    res.json({ success: true, message: "Meme added successfully!" });
});

// ----------------------
// SERVER HEALTH
// ----------------------

app.get("/", (req, res) => {
    res.send("Bot is running!");
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
