const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(bodyParser.json());

// ===== CONFIG =====
const MAIN_TOKEN = "8747945915:AAHFjkl-TypMYhCmokYgVT4XIIDJFyd1eFg";
const MAIN_API = `https://api.telegram.org/bot${MAIN_TOKEN}`;
const ADMIN_ID = 1953766793;

const BASE_URL = "https://revoltcheats.onrender.com"; // CHANGE

const DB_FILE = "data.json";

// ===== INIT DB =====
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    users: {},
    bots: {}, // userId -> token
    configs: {}, // token -> bot config
  }, null, 2));
}

function loadDB() {
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ===== SEND FUNCTION =====
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

// ===== MAIN BOT WEBHOOK =====
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
      text: "🚀 Welcome to Bot Maker\n\nCreate your own Telegram bot!",
      reply_markup: mainMenu()
    });
  }

  // CREATE BOT
  if (text === "🤖 Create Bot") {
    db.users[chat].state = "await_token";

    await send(MAIN_TOKEN, "sendMessage", {
      chat_id: chat,
      text: "🔑 Send your Bot Token from @BotFather"
    });
  }

  // RECEIVE TOKEN
  if (db.users[chat].state === "await_token" && text) {
    try {
      const check = await axios.get(`https://api.telegram.org/bot${text}/getMe`);

      if (!check.data.ok) throw new Error();

      // SAVE TOKEN
      db.bots[chat] = text;

      // DEFAULT CONFIG
      db.configs[text] = {
        channels: [],
        captions: {
          non_root: "🔥 Non Root",
          root: "⚡ Root",
          kernel: "💀 Kernel"
        }
      };

      // SET WEBHOOK
      await axios.get(
        `https://api.telegram.org/bot${text}/setWebhook?url=${BASE_URL}/${text}`
      );

      await send(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "✅ Bot Activated Successfully 🚀"
      });

    } catch {
      await send(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "❌ Invalid Token"
      });
    }

    delete db.users[chat].state;
    saveDB(db);
  }

  // MY BOT
  if (text === "📊 My Bot") {
    const token = db.bots[chat];

    if (!token) {
      await send(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "❌ No bot created yet"
      });
    } else {
      const info = await axios.get(`https://api.telegram.org/bot${token}/getMe`);

      await send(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: `🤖 Your Bot:\n@${info.data.result.username}`
      });
    }
  }
});

// ===== CLONED BOT HANDLER =====
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

  // START
  if (text === "/start") {
    await botSend("sendMessage", {
      chat_id: chat,
      text: "⚡ Welcome to your custom Revolt Bot",
      reply_markup: {
        keyboard: [
          ["📱 Non Root", "⚡ Root"],
          ["💀 Kernel"]
        ],
        resize_keyboard: true
      }
    });
  }

  // MODES
  if (text === "📱 Non Root") config.state = "non_root";
  if (text === "⚡ Root") config.state = "root";
  if (text === "💀 Kernel") config.state = "kernel";

  if (msg.photo && config.state) {
    const photo = msg.photo[msg.photo.length - 1].file_id;
    const caption = config.captions[config.state];

    for (let ch of config.channels) {
      await botSend("sendPhoto", {
        chat_id: ch,
        photo,
        caption
      });
    }

    await botSend("sendMessage", {
      chat_id: chat,
      text: "✅ Posted Successfully"
    });
  }

  saveDB(db);
});

// ===== WEB DASHBOARD =====
app.get("/", (req, res) => {
  const db = loadDB();

  res.send(`
    <h1>⚡ Revolt Bot Platform</h1>
    <p>Total Users: ${Object.keys(db.bots).length}</p>
    <p>Total Bots: ${Object.keys(db.configs).length}</p>
    <p>Status: Running 🚀</p>
  `);
});

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Server Running"));
