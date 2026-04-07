const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(bodyParser.json());

// ===== CONFIG =====
const MAIN_TOKEN = "8747945915:AAHFjkl-TypMYhCmokYgVT4XIIDJFyd1eFg";
const BASE_URL = "https://revoltcheats.onrender.com"; // CHANGE THIS
const DB_FILE = "data.json";

// ===== INIT DB =====
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    users: {},
    bots: {},
    configs: {},
    tempToken: {}
  }, null, 2));
}

function loadDB() {
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

async function send(token, method, data) {
  return axios.post(`https://api.telegram.org/bot${token}/${method}`, data);
}

// ===== MAIN MENU =====
function mainMenu() {
  return {
    keyboard: [
      ["🤖 Create Bot"],
      ["📊 My Bot"]
    ],
    resize_keyboard: true
  };
}

// ===== MAIN BOT =====
app.post("/", async (req, res) => {
  res.sendStatus(200);

  const update = req.body;
  let db = loadDB();

  if (!update.message) return;

  const msg = update.message;
  const chat = msg.chat.id;
  const text = msg.text;

  if (!db.users[chat]) db.users[chat] = {};

  // START
  if (text === "/start") {
    await send(MAIN_TOKEN, "sendMessage", {
      chat_id: chat,
      text: "🚀 Revolt Bot Maker",
      reply_markup: mainMenu()
    });
    return;
  }

  // CREATE BOT
  if (text === "🤖 Create Bot") {
    db.users[chat].state = "await_token";

    await send(MAIN_TOKEN, "sendMessage", {
      chat_id: chat,
      text: "🔑 Send Bot Token"
    });

    saveDB(db);
    return;
  }

  // TOKEN
  if (db.users[chat].state === "await_token") {
    if (!text || !text.includes(":") || text.length < 30) {
      await send(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "❌ Invalid Token"
      });
      return;
    }

    try {
      const check = await axios.get(`https://api.telegram.org/bot${text}/getMe`);
      if (!check.data.ok) throw new Error();

      db.tempToken[chat] = text;
      db.users[chat].state = "await_admin";

      await send(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "👤 Send Admin Chat ID"
      });

    } catch {
      await send(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "❌ Invalid Token"
      });
    }

    saveDB(db);
    return;
  }

  // ADMIN ID
  if (db.users[chat].state === "await_admin") {
    const token = db.tempToken[chat];

    if (!text || isNaN(text)) {
      await send(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "❌ Invalid Chat ID"
      });
      return;
    }

    db.bots[chat] = token;

    db.configs[token] = {
      admin: Number(text),
      channels: [],
      modes: {},
      userStates: {},
      logs: [],
      stats: { posts: 0 }
    };

    await axios.get(
      `https://api.telegram.org/bot${token}/setWebhook?url=${BASE_URL}/${token}`
    );

    await send(MAIN_TOKEN, "sendMessage", {
      chat_id: chat,
      text: "✅ Bot Created 🚀"
    });

    delete db.users[chat].state;
    delete db.tempToken[chat];

    saveDB(db);
    return;
  }
});

// ===== CLONED BOT =====
app.post("/:token", async (req, res) => {
  res.sendStatus(200);

  const token = req.params.token;
  const update = req.body;

  let db = loadDB();
  if (!db.configs[token]) return;

  const config = db.configs[token];

  async function botSend(method, data) {
    return axios.post(`https://api.telegram.org/bot${token}/${method}`, data);
  }

  if (!update.message) return;

  const msg = update.message;
  const chat = msg.chat.id;
  const text = msg.text;
  const userId = msg.from.id;

  if (userId !== config.admin) {
    await botSend("sendMessage", {
      chat_id: chat,
      text: "⛔ Admin only"
    });
    return;
  }

  config.channels ||= [];
  config.modes ||= {};
  config.userStates ||= {};
  config.logs ||= [];
  config.stats ||= { posts: 0 };

  // ===== MENU =====
  function mainMenu() {
    let btn = Object.keys(config.modes).map(m => [m]);
    btn.push(["➕ Add Mode"]);
    btn.push(["✏️ Edit Mode", "❌ Delete Mode"]);
    btn.push(["📢 Channels"]);
    btn.push(["📊 Stats", "🧾 Logs"]);
    return { keyboard: btn, resize_keyboard: true };
  }

  // START
  if (text === "/start") {
    await botSend("sendMessage", {
      chat_id: chat,
      text: "⚡ Your Custom Bot",
      reply_markup: mainMenu()
    });
    return;
  }

  // ===== ADD MODE =====
  if (text === "➕ Add Mode") {
    config.userStates[userId] = "await_mode";

    await botSend("sendMessage", {
      chat_id: chat,
      text: "alias - caption"
    });

    saveDB(db);
    return;
  }

  if (config.userStates[userId] === "await_mode") {
    if (!text || !text.includes("-")) {
      await botSend("sendMessage", {
        chat_id: chat,
        text: "❌ Use: alias - caption"
      });
      return;
    }

    let [alias, ...rest] = text.split("-");
    alias = alias.trim().toLowerCase();
    let caption = rest.join("-").trim();

    if (!alias || !caption) {
      await botSend("sendMessage", {
        chat_id: chat,
        text: "❌ Invalid"
      });
      return;
    }

    config.modes[alias] = caption;

    delete config.userStates[userId];
    saveDB(db);

    await botSend("sendMessage", {
      chat_id: chat,
      text: `✅ Mode ${alias} added`,
      reply_markup: mainMenu()
    });
    return;
  }

  // ===== DELETE MODE =====
  if (text === "❌ Delete Mode") {
    config.userStates[userId] = "delete";
    await botSend("sendMessage", { chat_id: chat, text: "Send mode name" });
    return;
  }

  if (config.userStates[userId] === "delete") {
    delete config.modes[text];
    delete config.userStates[userId];
    saveDB(db);

    await botSend("sendMessage", {
      chat_id: chat,
      text: "Deleted",
      reply_markup: mainMenu()
    });
    return;
  }

  // ===== CHANNEL ADD =====
  if (text === "📢 Channels") {
    config.userStates[userId] = "channel";
    await botSend("sendMessage", { chat_id: chat, text: "Send channel ID" });
    return;
  }

  if (config.userStates[userId] === "channel") {
    config.channels.push(text);
    delete config.userStates[userId];
    saveDB(db);

    await botSend("sendMessage", {
      chat_id: chat,
      text: "Added",
      reply_markup: mainMenu()
    });
    return;
  }

  // ===== MODE SELECT =====
  if (config.modes[text]) {
    config.userStates[userId] = { mode: text, media: [] };

    await botSend("sendMessage", {
      chat_id: chat,
      text: "Send photos then DONE"
    });
    return;
  }

  // ===== PHOTO =====
  if (msg.photo && config.userStates[userId]?.media) {
    const p = msg.photo[msg.photo.length - 1].file_id;
    config.userStates[userId].media.push(p);

    await botSend("sendMessage", {
      chat_id: chat,
      text: "Added"
    });
    return;
  }

  // ===== DONE =====
  if (text === "DONE" && config.userStates[userId]?.media) {
    let data = config.userStates[userId];
    let caption = config.modes[data.mode];

    for (let ch of config.channels) {
      await botSend("sendMediaGroup", {
        chat_id: ch,
        media: data.media.map((m, i) => ({
          type: "photo",
          media: m,
          caption: i === 0 ? caption : ""
        }))
      });
    }

    config.stats.posts++;
    config.logs.push(`Posted ${data.media.length}`);

    delete config.userStates[userId];
    saveDB(db);

    await botSend("sendMessage", {
      chat_id: chat,
      text: "Posted",
      reply_markup: mainMenu()
    });
  }
});

// ===== WEB =====
app.get("/", (req, res) => {
  res.send("Bot Running 🚀");
});

app.listen(3000, () => console.log("Running 🚀"));
