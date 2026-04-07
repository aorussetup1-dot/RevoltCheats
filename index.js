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

const BASE_URL = "https://revoltcheats.onrender.com"; // CHANGE THIS

const DB_FILE = "data.json";

// ===== INIT DB =====
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    users: {},
    bots: {},
    configs: {}
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

  // ===== START =====
  if (text === "/start") {
    await send(MAIN_TOKEN, "sendMessage", {
      chat_id: chat,
      text: "🚀 Welcome to Revolt Bot Maker\n\nCreate your own Telegram bot!",
      reply_markup: mainMenu()
    });
    return;
  }

  // ===== CREATE BOT BUTTON =====
  if (text === "🤖 Create Bot") {
    db.users[chat].state = "await_token";

    await send(MAIN_TOKEN, "sendMessage", {
      chat_id: chat,
      text: "🔑 Send your Bot Token from @BotFather\n\nExample:\n123456:ABC-xyz..."
    });

    saveDB(db);
    return;
  }

  // ===== TOKEN INPUT (FIXED) =====
  if (db.users[chat].state === "await_token") {

    // ignore button text
    if (text === "🤖 Create Bot") return;

    // invalid format
    if (!text || !text.includes(":") || text.length < 30) {
      await send(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "⚠️ Please send a valid bot token from @BotFather"
      });
      return;
    }

    try {
      const check = await axios.get(`https://api.telegram.org/bot${text}/getMe`);

      if (!check.data.ok) throw new Error();

      // SAVE BOT
      db.bots[chat] = text;

      // DEFAULT CONFIG
      db.configs[text] = {
        channels: [],
        captions: {
          non_root: "🔥 Non Root Loader",
          root: "⚡ Root Loader",
          kernel: "💀 Kernel Loader"
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
    return;
  }

  // ===== MY BOT =====
  if (text === "📊 My Bot") {
    const token = db.bots[chat];

    if (!token) {
      await send(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "❌ You haven't created any bot yet"
      });
      return;
    }

    try {
      const info = await axios.get(`https://api.telegram.org/bot${token}/getMe`);

      await send(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: `🤖 Your Bot:\n@${info.data.result.username}`
      });

    } catch {
      await send(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "⚠️ Bot error, try again"
      });
    }
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

  // ===== START =====
  if (text === "/start") {
    await botSend("sendMessage", {
      chat_id: chat,
      text: "⚡ Welcome to your Revolt Bot",
      reply_markup: {
        keyboard: [
          ["📱 Non Root", "⚡ Root"],
          ["💀 Kernel"]
        ],
        resize_keyboard: true
      }
    });
    return;
  }

  // ===== MODE SELECT =====
  if (text === "📱 Non Root") config.state = "non_root";
  if (text === "⚡ Root") config.state = "root";
  if (text === "💀 Kernel") config.state = "kernel";

  if (["📱 Non Root", "⚡ Root", "💀 Kernel"].includes(text)) {
    await botSend("sendMessage", {
      chat_id: chat,
      text: "📸 Send your photo"
    });
  }

  // ===== PHOTO HANDLER =====
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
      text: "✅ Posted Successfully 🚀"
    });
  }

  saveDB(db);
});

// ===== WEB DASHBOARD =====
app.get("/", (req, res) => {
  const db = loadDB();

  const totalUsers = Object.keys(db.bots).length;
  const totalBots = Object.keys(db.configs).length;

  res.send(`
  <html>
  <head>
    <title>Revolt Bot</title>
    <style>
      body {
        background: #0a0a0a;
        color: #00ffcc;
        font-family: monospace;
        text-align: center;
        padding-top: 100px;
      }
      h1 {
        font-size: 40px;
        text-shadow: 0 0 20px #00ffcc;
      }
      .card {
        margin: 20px auto;
        padding: 20px;
        width: 200px;
        background: #111;
        border-radius: 10px;
        box-shadow: 0 0 15px #00ffcc33;
      }
    </style>
  </head>
  <body>
    <h1>⚡ REVOLT BOT</h1>
    <div class="card">👥 Users: ${totalUsers}</div>
    <div class="card">🤖 Bots: ${totalBots}</div>
    <p>🚀 Running...</p>
    <p>@ARxSHUBH</p>
  </body>
  </html>
  `);
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Server Running"));
