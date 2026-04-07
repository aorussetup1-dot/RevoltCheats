// ===== index.js =====
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(bodyParser.json());

// ===== CONFIG (ENV ONLY) =====
const MAIN_TOKEN = process.env.MAIN_TOKEN;          // REQUIRED
const BASE_URL  = process.env.BASE_URL;             // REQUIRED (https)
const PORT      = process.env.PORT || 3000;
const DB_FILE   = "data.json";

if (!MAIN_TOKEN || !BASE_URL) {
  console.error("❌ Missing MAIN_TOKEN or BASE_URL env vars");
  process.exit(1);
}

// ===== INIT DB =====
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    users: {},
    bots: {},
    configs: {},
    tempToken: {}
  }, null, 2));
}

const loadDB = () => JSON.parse(fs.readFileSync(DB_FILE));
const saveDB = (d) => fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2));

// ===== SAFE TELEGRAM CALL =====
async function tg(token, method, data) {
  try {
    return await axios.post(`https://api.telegram.org/bot${token}/${method}`, data);
  } catch (err) {
    console.log("❌ TG Error:", err.response?.data || err.message);
  }
}

// ===== AUTO WEBHOOK =====
async function setWebhook(token, path = "") {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await axios.get(
      `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(url)}`
    );
    console.log("✅ Webhook set:", url, res.data);
  } catch (err) {
    console.log("❌ Webhook error:", err.response?.data || err.message);
  }
}

// ===== MAIN MENU =====
const mainMenu = () => ({
  keyboard: [["🤖 Create Bot"], ["📊 My Bot"]],
  resize_keyboard: true
});

// ===== MAIN BOT =====
app.post("/", async (req, res) => {
  res.sendStatus(200);
  console.log("📩 MAIN:", JSON.stringify(req.body));

  const db = loadDB();
  const msg = req.body.message;
  if (!msg) return;

  const chat = msg.chat.id;
  const text = msg.text;
  db.users[chat] ||= {};

  // START
  if (text === "/start") {
    await tg(MAIN_TOKEN, "sendMessage", {
      chat_id: chat,
      text: "🚀 Revolt Bot Maker",
      reply_markup: mainMenu()
    });
    return;
  }

  // CREATE BOT
  if (text === "🤖 Create Bot") {
    db.users[chat].state = "token";
    saveDB(db);
    await tg(MAIN_TOKEN, "sendMessage", {
      chat_id: chat,
      text: "🔑 Send Bot Token from @BotFather"
    });
    return;
  }

  // TOKEN INPUT
  if (db.users[chat].state === "token") {
    if (!text || !text.includes(":") || text.length < 30) {
      await tg(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "❌ Invalid token format"
      });
      return;
    }

    try {
      const check = await axios.get(`https://api.telegram.org/bot${text}/getMe`);
      if (!check.data.ok) throw new Error();

      db.tempToken[chat] = text;
      db.users[chat].state = "admin";
      saveDB(db);

      await tg(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "👤 Send Admin Chat ID (your user id or group id)"
      });
    } catch {
      await tg(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "❌ Invalid token"
      });
    }
    return;
  }

  // ADMIN ID
  if (db.users[chat].state === "admin") {
    if (!text || isNaN(text)) {
      await tg(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "❌ Invalid Chat ID"
      });
      return;
    }

    const token = db.tempToken[chat];

    db.bots[chat] = token;
    db.configs[token] = {
      admin: Number(text),
      channels: [],
      modes: {},          // alias -> caption
      state: {},          // per-user temp state
      stats: { posts: 0 },
      logs: []
    };

    await setWebhook(token, `/${token}`);

    delete db.tempToken[chat];
    delete db.users[chat].state;
    saveDB(db);

    await tg(MAIN_TOKEN, "sendMessage", {
      chat_id: chat,
      text: "✅ Bot created & webhook set 🚀"
    });
    return;
  }

  // MY BOT
  if (text === "📊 My Bot") {
    const token = db.bots[chat];

    if (!token) {
      await tg(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "❌ You haven't created any bot yet"
      });
      return;
    }

    try {
      const info = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
      await tg(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text:
`🤖 Your Bot

👤 ${info.data.result.first_name}
🔗 @${info.data.result.username}
🆔 ${info.data.result.id}

✅ Active`
      });
    } catch {
      await tg(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "⚠️ Bot not responding"
      });
    }
  }
});

// ===== CLONED BOT HANDLER =====
app.post("/:token", async (req, res) => {
  res.sendStatus(200);
  console.log("📩 CLONE:", JSON.stringify(req.body));

  const token = req.params.token;
  const db = loadDB();
  const config = db.configs[token];
  if (!config) return;

  const msg = req.body.message;
  if (!msg) return;

  const chat = msg.chat.id;
  const text = msg.text;
  const user = msg.from.id;

  const sendBot = (m, d) =>
    axios.post(`https://api.telegram.org/bot${token}/${m}`, d);

  // ADMIN ONLY
  if (user !== config.admin) {
    await sendBot("sendMessage", {
      chat_id: chat,
      text: "⛔ Admin only"
    });
    return;
  }

  config.state[user] ||= {};

  const menu = () => ({
    keyboard: [
      ...Object.keys(config.modes).map(m => [m]),
      ["➕ Add Mode"],
      ["❌ Delete Mode"],
      ["📢 Add Channel"],
      ["📊 Stats", "🧾 Logs"]
    ],
    resize_keyboard: true
  });

  // START
  if (text === "/start") {
    await sendBot("sendMessage", {
      chat_id: chat,
      text: "⚡ Custom Bot Ready",
      reply_markup: menu()
    });
    return;
  }

  // ADD MODE
  if (text === "➕ Add Mode") {
    config.state[user].mode = "add";
    saveDB(db);
    await sendBot("sendMessage", {
      chat_id: chat,
      text: "Send: alias - caption"
    });
    return;
  }

  if (config.state[user]?.mode === "add") {
    if (!text || !text.includes("-")) {
      await sendBot("sendMessage", {
        chat_id: chat,
        text: "❌ Use: alias - caption"
      });
      return;
    }

    let [a, ...b] = text.split("-");
    const alias = a.trim().toLowerCase();
    const caption = b.join("-").trim();

    if (!alias || !caption) {
      await sendBot("sendMessage", {
        chat_id: chat,
        text: "❌ Invalid input"
      });
      return;
    }

    config.modes[alias] = caption;
    delete config.state[user].mode;
    saveDB(db);

    await sendBot("sendMessage", {
      chat_id: chat,
      text: `✅ Mode "${alias}" added`,
      reply_markup: menu()
    });
    return;
  }

  // DELETE MODE
  if (text === "❌ Delete Mode") {
    config.state[user].mode = "delete";
    await sendBot("sendMessage", {
      chat_id: chat,
      text: "Send mode name to delete"
    });
    return;
  }

  if (config.state[user]?.mode === "delete") {
    if (!config.modes[text]) {
      await sendBot("sendMessage", {
        chat_id: chat,
        text: "❌ Mode not found"
      });
      return;
    }

    delete config.modes[text];
    delete config.state[user].mode;
    saveDB(db);

    await sendBot("sendMessage", {
      chat_id: chat,
      text: "❌ Mode deleted",
      reply_markup: menu()
    });
    return;
  }

  // ADD CHANNEL
  if (text === "📢 Add Channel") {
    config.state[user].mode = "channel";
    await sendBot("sendMessage", {
      chat_id: chat,
      text: "Send channel ID (e.g. -100xxxxxxxxxx)"
    });
    return;
  }

  if (config.state[user]?.mode === "channel") {
    if (!config.channels.includes(text)) {
      config.channels.push(text);
    }
    delete config.state[user].mode;
    saveDB(db);

    await sendBot("sendMessage", {
      chat_id: chat,
      text: "✅ Channel added",
      reply_markup: menu()
    });
    return;
  }

  // SELECT MODE → START MULTI-UPLOAD
  if (config.modes[text]) {
    config.state[user] = { post: text, media: [] };
    await sendBot("sendMessage", {
      chat_id: chat,
      text: "📸 Send photos, then type DONE"
    });
    return;
  }

  // COLLECT PHOTOS
  if (msg.photo && config.state[user]?.media) {
    config.state[user].media.push(
      msg.photo[msg.photo.length - 1].file_id
    );
    await sendBot("sendMessage", {
      chat_id: chat,
      text: "✅ Added"
    });
    return;
  }

  // POST
  if (text === "DONE" && config.state[user]?.media) {
    if (config.channels.length === 0) {
      await sendBot("sendMessage", {
        chat_id: chat,
        text: "⚠️ No channels added"
      });
      return;
    }

    const data = config.state[user];

    for (let ch of config.channels) {
      try {
        await sendBot("sendMediaGroup", {
          chat_id: ch,
          media: data.media.map((m, i) => ({
            type: "photo",
            media: m,
            caption: i === 0 ? config.modes[data.post] : ""
          }))
        });
      } catch {
        await sendBot("sendMessage", {
          chat_id: chat,
          text: "❌ Failed to post (check bot admin rights)"
        });
      }
    }

    config.stats.posts++;
    config.logs.push(`Posted ${data.media.length} photos`);

    delete config.state[user];
    saveDB(db);

    await sendBot("sendMessage", {
      chat_id: chat,
      text: "🚀 Posted Successfully",
      reply_markup: menu()
    });
    return;
  }

  // STATS
  if (text === "📊 Stats") {
    await sendBot("sendMessage", {
      chat_id: chat,
      text: `Posts: ${config.stats.posts}`
    });
  }

  // LOGS
  if (text === "🧾 Logs") {
    await sendBot("sendMessage", {
      chat_id: chat,
      text: config.logs.slice(-5).join("\n") || "No logs"
    });
  }
});

// ===== HEALTH =====
app.get("/", (req, res) => {
  res.send("🚀 Bot Running");
});

// ===== START =====
app.listen(PORT, async () => {
  console.log("🚀 Server started");
  await setWebhook(MAIN_TOKEN);
});
