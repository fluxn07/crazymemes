import os
import json
import aiohttp
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ApplicationBuilder, CommandHandler, CallbackQueryHandler,
    ContextTypes
)
from apscheduler.schedulers.asyncio import AsyncIOScheduler

load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")

USERS_FILE = "users.json"
USED_FILE = "used_jokes.json"

# -------------------------------------
# Load / Save JSON
# -------------------------------------
def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r") as f:
        return json.load(f)

def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=4)

# -------------------------------------
# Fetch NEW Joke from API
# -------------------------------------
async def fetch_joke():
    url = "https://v2.jokeapi.dev/joke/Any?type=single&safe-mode"
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            data = await resp.json()
            return "😂 " + data.get("joke", "Joke not found 😅")

# -------------------------------------
# Guarantee Unique Joke per User
# -------------------------------------
async def get_unique_joke(user_id):
    used = load_json(USED_FILE, {})

    if str(user_id) not in used:
        used[str(user_id)] = []

    attempts = 0

    while attempts < 20:
        joke = await fetch_joke()
        if joke not in used[str(user_id)]:
            used[str(user_id)].append(joke)
            save_json(USED_FILE, used)
            return joke
        attempts += 1

    # Reset if API repeats too much
    used[str(user_id)] = []
    save_json(USED_FILE, used)

    joke = await fetch_joke()
    used[str(user_id)].append(joke)
    save_json(USED_FILE, used)
    return joke

# -------------------------------------
# Buttons
# -------------------------------------
def joke_buttons():
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("😂 Another Joke", callback_data="another_joke"),
            InlineKeyboardButton("🌐 Open Site", url="https://sprightly-dasik-9939a7.netlify.app/")
        ]
    ])

# -------------------------------------
# /start command
# -------------------------------------
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    users = load_json(USERS_FILE, {"users": []})

    if user_id not in users["users"]:
        users["users"].append(user_id)
        save_json(USERS_FILE, users)

    joke = await get_unique_joke(user_id)
    await update.message.reply_text(
        f"🔥 Welcome! Here's a fresh joke:\n\n{joke}",
        reply_markup=joke_buttons()
    )

# -------------------------------------
# Handle Button (Another Joke)
# -------------------------------------
async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user_id = query.from_user.id

    await query.answer()

    joke = await get_unique_joke(user_id)
    await query.edit_message_text(joke, reply_markup=joke_buttons())

# -------------------------------------
# Daily Automatic Joke
# -------------------------------------
async def send_daily_jokes(app):
    users = load_json(USERS_FILE, {"users": []})

    for user_id in users["users"]:
        joke = await get_unique_joke(user_id)
        try:
            await app.bot.send_message(
                chat_id=user_id,
                text=f"🌞 Good Morning! Here's your daily joke:\n\n{joke}",
                reply_markup=joke_buttons()
            )
        except Exception as e:
            print(f"Failed to send to {user_id}: {e}")

# -------------------------------------
# Main Runner
# -------------------------------------
async def main():
    app = ApplicationBuilder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(button_handler))

    scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")
    scheduler.add_job(send_daily_jokes, "cron", hour=9, minute=0, args=[app])
    scheduler.start()

    print("🤖 Bot is running...")
    await app.run_polling()

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
