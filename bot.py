import os
import json
import aiohttp
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ApplicationBuilder, CommandHandler, CallbackQueryHandler,
    ContextTypes
)

load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")
PORT = int(os.environ.get("PORT", 8080))  # Railway port

USERS_FILE = "users.json"
USED_FILE = "used_jokes.json"

# ---------------------------------------------------
# JSON utils
# ---------------------------------------------------
def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r") as f:
        return json.load(f)

def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=4)

# ---------------------------------------------------
# Fetch Joke
# ---------------------------------------------------
async def fetch_joke():
    url = "https://v2.jokeapi.dev/joke/Any?type=single&safe-mode"
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            data = await resp.json()
            return "😂 " + data.get("joke", "Joke not found 😅")

# ---------------------------------------------------
# Unique Joke
# ---------------------------------------------------
async def get_unique_joke(user_id):
    used = load_json(USED_FILE, {})

    if str(user_id) not in used:
        used[str(user_id)] = []

    # Try 20 times for unique joke
    for _ in range(20):
        joke = await fetch_joke()
        if joke not in used[str(user_id)]:
            used[str(user_id)].append(joke)
            save_json(USED_FILE, used)
            return joke

    # Reset if many repeats
    used[str(user_id)] = []
    save_json(USED_FILE, used)

    joke = await fetch_joke()
    used[str(user_id)].append(joke)
    save_json(USED_FILE, used)
    return joke

# ---------------------------------------------------
# Buttons
# ---------------------------------------------------
def joke_buttons():
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("😂 Another Joke", callback_data="another_joke"),
            InlineKeyboardButton("🌐 Open Site", url="https://sprightly-dasik-9939a7.netlify.app/")
        ]
    ])

# ---------------------------------------------------
# Start
# ---------------------------------------------------
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    users = load_json(USERS_FILE, {"users": []})

    if user_id not in users["users"]:
        users["users"].append(user_id)
        save_json(USERS_FILE, users)

    joke = await get_unique_joke(user_id)
    await update.message.reply_text(
        f"🔥 Welcome! Here's your fresh joke:\n\n{joke}",
        reply_markup=joke_buttons()
    )

# ---------------------------------------------------
# Button Handler
# ---------------------------------------------------
async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user_id = query.from_user.id
    await query.answer()

    joke = await get_unique_joke(user_id)
    await query.edit_message_text(joke, reply_markup=joke_buttons())

# ---------------------------------------------------
# MAIN (WEBHOOK — NO POLLING)
# ---------------------------------------------------
async def main():
    app = ApplicationBuilder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(button_handler))

    # Webhook URL
    webhook_url = f"https://{os.environ['RAILWAY_PUBLIC_DOMAIN']}/webhook"

    await app.bot.set_webhook(webhook_url)
    print(f"🚀 Webhook set: {webhook_url}")

    # Start webhook server
    await app.run_webhook(
        listen="0.0.0.0",
        port=PORT,
        webhook_url=webhook_url
    )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
