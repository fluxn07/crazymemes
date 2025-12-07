require("dotenv").config();
const { Telegraf } = require("telegraf");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

// ----------------------
// INIT
// ----------------------
const bot = new Telegraf(process.env.BOT_TOKEN);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Generate UID
function generateUID() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ----------------------
// HELPERS
// ----------------------
async function getOrCreateUser(ctx) {
  const tgId = ctx.from.id;

  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", tgId)
    .single();

  // If user exists → return
  if (existing) return existing;

  // Otherwise create new user with UID
  const newUID = generateUID();

  const { data, error } = await supabase
    .from("users")
    .insert([
      {
        telegram_id: tgId,
        uid: newUID,
        username: ctx.from.username || null
      }
    ])
    .select()
    .single();

  return data;
}

// ----------------------
// COMMAND: /start
// ----------------------
bot.start(async (ctx) => {
  const user = await getOrCreateUser(ctx);

  await ctx.reply(
    `🔥 Welcome to MemeStreak!\n\nYour UID: *${user.uid}*\nShare this UID so friends can add you.\n\nOpen MemeStreak Hub 👇`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "🚀 Open Meme Hub", web_app: { url: process.env.WEBAPP_URL } }]]
      }
    }
  );
});

// ----------------------
// COMMAND: /myuid
// ----------------------
bot.command("myuid", async (ctx) => {
  const user = await getOrCreateUser(ctx);
  ctx.reply(`Your UID is: *${user.uid}*`, { parse_mode: "Markdown" });
});

// ----------------------
// COMMAND: /addfriend
// ----------------------
bot.command("addfriend", async (ctx) => {
  ctx.reply("Send the UID of the friend you want to add:");

  bot.once("text", async (msgCtx) => {
    const uid = msgCtx.message.text.trim();
    const user = await getOrCreateUser(msgCtx);

    // Check if UID exists
    const { data: friend } = await supabase
      .from("users")
      .select("*")
      .eq("uid", uid)
      .single();

    if (!friend) {
      return msgCtx.reply("❌ No user found with this UID.");
    }

    if (friend.uid === user.uid) {
      return msgCtx.reply("😅 You cannot add yourself.");
    }

    // Check if already added
    const { data: existing } = await supabase
      .from("friends")
      .select("*")
      .eq("user_uid", user.uid)
      .eq("friend_uid", friend.uid)
      .maybeSingle();

    if (existing) {
      return msgCtx.reply("⚠️ This friend is already added.");
    }

    // Add friend
    await supabase.from("friends").insert([
      {
        user_uid: user.uid,
        friend_uid: friend.uid
      }
    ]);

    msgCtx.reply(`✅ Friend added successfully!\nYou can now share memes with *${friend.uid}*`, {
      parse_mode: "Markdown"
    });
  });
});

// ----------------------
// COMMAND: /friends
// ----------------------
bot.command("friends", async (ctx) => {
  const user = await getOrCreateUser(ctx);

  const { data: list } = await supabase
    .from("friends")
    .select("friend_uid")
    .eq("user_uid", user.uid);

  if (!list || list.length === 0) {
    return ctx.reply("🚫 You have no friends added.");
  }

  let message = "👥 *Your Friends:*\n\n";
  for (const f of list) {
    message += `• UID: *${f.friend_uid}*\n`;
  }

  ctx.reply(message, { parse_mode: "Markdown" });
});

// ----------------------
// COMMAND: /opensite
// ----------------------
bot.command("opensite", (ctx) => {
  ctx.reply(
    "🌐 Open MemeStreak Hub:",
    {
      reply_markup: {
        inline_keyboard: [[{ text: "🚀 Open Website", web_app: { url: process.env.WEBAPP_URL } }]]
      }
    }
  );
});

// ----------------------
// API ENDPOINT FOR SITE → BOT SHARING
// ----------------------
bot.on("text", async () => {}); // keep default handler alive

// This webhook-style function will be called by your website backend
bot.telegram.setWebhook; // keep API flexible

// Create express server for API incoming calls
const express = require("express");
const app = express();
app.use(express.json());

app.post("/send-meme", async (req, res) => {
  const { meme_url, receiver_uid, sender_uid } = req.body;

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("uid", receiver_uid)
    .single();

  if (!user) return res.json({ success: false, error: "User not found" });

  await bot.telegram.sendPhoto(
    user.telegram_id,
    meme_url,
    { caption: `🔥 Meme sent by UID: ${sender_uid}` }
  );

  res.json({ success: true });
});

app.listen(3000, () => console.log("API running on port 3000"));

bot.launch();
console.log("🤖 Bot is running...");
