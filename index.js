const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(bodyParser.json());

// ===== CONFIG =====
const MAIN_TOKEN = "8747945915:AAHFjkl-TypMYhCmokYgVT4XIIDJFyd1eFg";
const MAIN_API = `https://api.telegram.org/bot${MAIN_TOKEN}`;
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
      text: "🚀 Welcome to Revolt Bot Maker",
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

  // TOKEN INPUT
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

  // ADMIN ID INPUT
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
      text: "✅ Bot Created Successfully 🚀"
    });

    delete db.users[chat].state;
    delete db.tempToken[chat];

    saveDB(db);
    return;
  }

  // MY BOT
  if (text === "📊 My Bot") {
    const token = db.bots[chat];

    if (!token) {
      await send(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "❌ No bot found"
      });
      return;
    }

    const info = await axios.get(`https://api.telegram.org/bot${token}/getMe`);

    await send(MAIN_TOKEN, "sendMessage", {
      chat_id: chat,
      text: `🤖 Your Bot: @${info.data.result.username}`
    });
  }
});

// ===== CLONED BOT SYSTEM =====
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

  function mainMenu() {
    let buttons = Object.keys(config.modes).map(m => [m]);
    buttons.push(["➕ Add Mode"]);
    buttons.push(["✏️ Edit Mode", "❌ Delete Mode"]);
    buttons.push(["📢 Channels"]);
    buttons.push(["📊 Stats", "🧾 Logs"]);
    return { keyboard: buttons, resize_keyboard: true };
  }

  function channelMenu() {
    return {
      keyboard: [
        ["➕ Add Channel"],
        ["➖ Remove Channel"],
        ["📄 List Channels"],
        ["🔙 Back"]
      ],
      resize_keyboard: true
    };
  }

  if (text === "/start") {
    await botSend("sendMessage", {
      chat_id: chat,
      text: "⚡ Your Custom Revolt Bot",
      reply_markup: mainMenu()
    });
    return;
  }

  if (text === "➕ Add Mode") {
    config.userStates[userId] = "add_mode";
    await botSend("sendMessage", { chat_id: chat, text: "alias - caption" });
    return;
  }

  if (config.userStates[userId] === "add_mode" && text.includes("-")) {
    let [a, c] = text.split("-", 2);
    config.modes[a.trim()] = c.trim();

    delete config.userStates[userId];
    saveDB(db);

    await botSend("sendMessage", {
      chat_id: chat,
      text: "✅ Mode added",
      reply_markup: mainMenu()
    });
    return;
  }

  if (text === "✏️ Edit Mode") {
    config.userStates[userId] = "edit_select";
    await botSend("sendMessage", { chat_id: chat, text: "Send mode name" });
    return;
  }

  if (config.userStates[userId] === "edit_select" && config.modes[text]) {
    config.userStates[userId] = { edit: text };
    await botSend("sendMessage", { chat_id: chat, text: "New caption" });
    return;
  }

  if (typeof config.userStates[userId] === "object") {
    let m = config.userStates[userId].edit;
    config.modes[m] = text;

    delete config.userStates[userId];
    saveDB(db);

    await botSend("sendMessage", {
      chat_id: chat,
      text: "✅ Updated",
      reply_markup: mainMenu()
    });
    return;
  }

  if (text === "❌ Delete Mode") {
    config.userStates[userId] = "delete_mode";
    await botSend("sendMessage", { chat_id: chat, text: "Send mode name" });
    return;
  }

  if (config.userStates[userId] === "delete_mode" && config.modes[text]) {
    delete config.modes[text];
    delete config.userStates[userId];
    saveDB(db);

    await botSend("sendMessage", {
      chat_id: chat,
      text: "❌ Deleted",
      reply_markup: mainMenu()
    });
    return;
  }

  if (text === "📢 Channels") {
    await botSend("sendMessage", {
      chat_id: chat,
      text: "Channel Manager",
      reply_markup: channelMenu()
    });
    return;
  }

  if (text === "🔙 Back") {
    await botSend("sendMessage", {
      chat_id: chat,
      text: "Back",
      reply_markup: mainMenu()
    });
    return;
  }

  if (text === "➕ Add Channel") {
    config.userStates[userId] = "add_channel";
    await botSend("sendMessage", { chat_id: chat, text: "Send channel ID" });
    return;
  }

  if (config.userStates[userId] === "add_channel") {
    config.channels.push(text);
    delete config.userStates[userId];
    saveDB(db);

    await botSend("sendMessage", {
      chat_id: chat,
      text: "✅ Added",
      reply_markup: channelMenu()
    });
    return;
  }

  if (text === "➖ Remove Channel") {
    config.userStates[userId] = "remove_channel";
    await botSend("sendMessage", { chat_id: chat, text: "Send ID" });
    return;
  }

  if (config.userStates[userId] === "remove_channel") {
    config.channels = config.channels.filter(c => c !== text);
    delete config.userStates[userId];
    saveDB(db);

    await botSend("sendMessage", {
      chat_id: chat,
      text: "❌ Removed",
      reply_markup: channelMenu()
    });
    return;
  }

  if (text === "📄 List Channels") {
    await botSend("sendMessage", {
      chat_id: chat,
      text: config.channels.join("\n") || "No channels"
    });
    return;
  }

  if (text === "📊 Stats") {
    await botSend("sendMessage", {
      chat_id: chat,
      text: `Posts: ${config.stats.posts}`
    });
    return;
  }

  if (text === "🧾 Logs") {
    await botSend("sendMessage", {
      chat_id: chat,
      text: config.logs.slice(-5).join("\n") || "No logs"
    });
    return;
  }

  if (config.modes[text]) {
    config.userStates[userId] = { postMode: text, media: [] };
    await botSend("sendMessage", {
      chat_id: chat,
      text: "Send photos then DONE"
    });
    return;
  }

  if (msg.photo && config.userStates[userId]?.media) {
    const p = msg.photo[msg.photo.length - 1].file_id;
    config.userStates[userId].media.push(p);

    await botSend("sendMessage", {
      chat_id: chat,
      text: "Added"
    });
    return;
  }

  if (text === "DONE" && config.userStates[userId]?.media) {
    const data = config.userStates[userId];
    const caption = config.modes[data.postMode];

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
    config.logs.push(`Posted ${data.media.length} photos`);

    delete config.userStates[userId];
    saveDB(db);

    await botSend("sendMessage", {
      chat_id: chat,
      text: "✅ Posted",
      reply_markup: mainMenu()
    });
  }
});

// ===== DASHBOARD =====
app.get("/", (req, res) => {
  const db = loadDB();

  res.send(`
    <h1>⚡ Revolt Bot</h1>
    <p>Users: ${Object.keys(db.bots).length}</p>
    <p>Bots: ${Object.keys(db.configs).length}</p>
    <p>Status: Running 🚀</p>
  `);
});

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Running"));
