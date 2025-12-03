import dotenv from "dotenv";
import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import fs from "fs";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

const USERS_FILE = "users.json";
const USED_FILE = "used_jokes.json";

// ---------------------------
// Helpers: Load & Save JSON
// ---------------------------
function loadJSON(path, fallback) {
    if (!fs.existsSync(path)) return fallback;
    return JSON.parse(fs.readFileSync(path));
}

function saveJSON(path, data) {
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

// ---------------------------
// Fetch Joke from API
// ---------------------------
async function fetchJoke() {
    try {
        const res = await axios.get(
            "https://v2.jokeapi.dev/joke/Any?type=single&safe-mode"
        );
        return "😂 " + res.data.joke;
    } catch (e) {
        return "😅 Couldn't fetch a joke!";
    }
}

// ---------------------------
// Unique Joke Per User
// ---------------------------
async function getUniqueJoke(userId) {
    let used = loadJSON(USED_FILE, {});
    if (!used[userId]) used[userId] = [];

    for (let i = 0; i < 20; i++) {
        const joke = await fetchJoke();
        if (!used[userId].includes(joke)) {
            used[userId].push(joke);
            saveJSON(USED_FILE, used);
            return joke;
        }
    }

    used[userId] = [];
    saveJSON(USED_FILE, used);

    const joke = await fetchJoke();
    used[userId].push(joke);
    saveJSON(USED_FILE, used);
    return joke;
}

// ---------------------------
// Buttons Layout
// ---------------------------
function jokeButtons() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback("😂 Another Joke", "another"),
            Markup.button.url(
                "🌐 Open Site",
                "https://sprightly-dasik-9939a7.netlify.app/"
            )
        ]
    ]);
}

// ---------------------------
// /start command
// ---------------------------
bot.start(async (ctx) => {
    const userId = ctx.from.id;

    let users = loadJSON(USERS_FILE, { users: [] });
    if (!users.users.includes(userId)) {
        users.users.push(userId);
        saveJSON(USERS_FILE, users);
    }

    const joke = await getUniqueJoke(userId);
    await ctx.reply(`🔥 Welcome! Here's your fresh joke:\n\n${joke}`, jokeButtons());
});

// ---------------------------
// Button Handler
// ---------------------------
bot.action("another", async (ctx) => {
    const userId = ctx.from.id;
    const joke = await getUniqueJoke(userId);

    await ctx.editMessageText(joke, jokeButtons());
});

// ---------------------------
// Launch Bot
// ---------------------------
bot.launch();
console.log("🤖 Bot is running (Node.js + Telegraf)...");

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
