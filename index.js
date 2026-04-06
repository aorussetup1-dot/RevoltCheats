const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(bodyParser.json());

// ===== CONFIG =====
const TOKEN = "8747945915:AAHFjkl-TypMYhCmokYgVT4XIIDJFyd1eFg";
const API = `https://api.telegram.org/bot${TOKEN}`;
const ADMIN_ID = 1953766793;

const DB_FILE = "data.json";

// ===== INIT DB =====
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    users: {},
    channels: ["-1003360024342", "-1002219330498"],
    captions: {
      non_root: "Revolt Cheats Non Root 🔥",
      root: "Revolt Cheats Root ⚡",
      kernel: "Revolt Cheats Kernel 💀"
    }
  }, null, 2));
}

function loadDB() {
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ===== TELEGRAM SEND =====
async function send(method, data) {
  return axios.post(`${API}/${method}`, data);
}

// ===== MAIN MENU =====
function mainMenu(isAdmin = false) {
  let keyboard = [
    ["📱 Non Root", "⚡ Root"],
    ["💀 Kernel"]
  ];

  if (isAdmin) keyboard.push(["⚙️ Admin Panel"]);

  return {
    keyboard,
    resize_keyboard: true
  };
}

// ===== ADMIN MENU =====
function adminMenu() {
  return {
    keyboard: [
      ["✏️ Edit Caption"],
      ["➕ Add Channel", "➖ Remove Channel"],
      ["📊 View Channels"],
      ["🔙 Back"]
    ],
    resize_keyboard: true
  };
}

// ===== 🌐 WEB DASHBOARD =====
app.get("/", (req, res) => {
  const db = loadDB();

  const totalUsers = Object.keys(db.users).length;
  const totalChannels = db.channels.length;

  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>Revolt Bot</title>
    <style>
      body {
        margin: 0;
        height: 100vh;
        background: #0a0a0a;
        color: #00ffcc;
        font-family: monospace;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
      }

      h1 {
        font-size: 42px;
        text-shadow: 0 0 20px #00ffcc;
        animation: glow 1.5s infinite alternate;
      }

      .status {
        margin-top: 10px;
        font-size: 18px;
        color: #aaa;
      }

      .stats {
        display: flex;
        gap: 30px;
        margin-top: 30px;
      }

      .card {
        background: #111;
        padding: 20px 40px;
        border-radius: 10px;
        box-shadow: 0 0 15px #00ffcc33;
        text-align: center;
      }

      .card h2 {
        font-size: 30px;
        margin: 0;
      }

      .card p {
        margin: 5px 0 0;
        color: #888;
      }

      .loader {
        margin-top: 20px;
        border: 4px solid #222;
        border-top: 4px solid #00ffcc;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
      }

      .username {
        margin-top: 20px;
        color: #00ccff;
        font-size: 18px;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @keyframes glow {
        from { text-shadow: 0 0 10px #00ffcc; }
        to { text-shadow: 0 0 30px #00ffcc; }
      }
    </style>
  </head>
  <body>

    <h1>⚡ REVOLT BOT</h1>
    <div class="status">🚀 Bot is Running</div>

    <div class="loader"></div>

    <div class="stats">
      <div class="card">
        <h2>${totalUsers}</h2>
        <p>Users</p>
      </div>
      <div class="card">
        <h2>${totalChannels}</h2>
        <p>Channels</p>
      </div>
    </div>

    <div class="username">📡 @ARxSHUBH</div>

  </body>
  </html>
  `);
});

// ===== WEBHOOK =====
app.post("/", async (req, res) => {
  res.sendStatus(200);

  const update = req.body;
  let db = loadDB();

  if (update.message) {
    const msg = update.message;
    const chat = msg.chat.id;
    const text = msg.text;
    const isAdmin = msg.from.id === ADMIN_ID;

    // track user
    if (!db.users[chat]) db.users[chat] = {};

    // START
    if (text === "/start") {
      await send("sendMessage", {
        chat_id: chat,
        text: "👋 Welcome to Revolt Bot\n\nSelect Mode 👇",
        reply_markup: mainMenu(isAdmin)
      });
    }

    // MODES
    if (text === "📱 Non Root") db.users[chat].state = "non_root";
    if (text === "⚡ Root") db.users[chat].state = "root";
    if (text === "💀 Kernel") db.users[chat].state = "kernel";

    if (["📱 Non Root", "⚡ Root", "💀 Kernel"].includes(text)) {
      await send("sendMessage", {
        chat_id: chat,
        text: "📸 Send your photo"
      });
    }

    // ADMIN PANEL
    if (text === "⚙️ Admin Panel" && isAdmin) {
      await send("sendMessage", {
        chat_id: chat,
        text: "⚙️ Admin Panel",
        reply_markup: adminMenu()
      });
    }

    if (text === "🔙 Back") {
      await send("sendMessage", {
        chat_id: chat,
        text: "⬅️ Back",
        reply_markup: mainMenu(isAdmin)
      });
    }

    // ADD CHANNEL
    if (text === "➕ Add Channel" && isAdmin) {
      db.users[chat].state = "add_channel";

      await send("sendMessage", {
        chat_id: chat,
        text: "Send Channel ID"
      });
    }

    if (db.users[chat].state === "add_channel" && text && isAdmin) {
      if (!db.channels.includes(text)) db.channels.push(text);

      await send("sendMessage", {
        chat_id: chat,
        text: "✅ Channel Added"
      });

      delete db.users[chat].state;
    }

    // REMOVE CHANNEL
    if (text === "➖ Remove Channel" && isAdmin) {
      db.users[chat].state = "remove_channel";

      await send("sendMessage", {
        chat_id: chat,
        text: "Send Channel ID"
      });
    }

    if (db.users[chat].state === "remove_channel" && text && isAdmin) {
      db.channels = db.channels.filter(c => c !== text);

      await send("sendMessage", {
        chat_id: chat,
        text: "❌ Channel Removed"
      });

      delete db.users[chat].state;
    }

    // PHOTO
    if (msg.photo) {
      const state = db.users[chat]?.state;
      if (!state) return;

      const photo = msg.photo[msg.photo.length - 1].file_id;
      const caption = db.captions[state];

      for (let ch of db.channels) {
        await send("sendPhoto", {
          chat_id: ch,
          photo,
          caption
        });
      }

      await send("sendMessage", {
        chat_id: chat,
        text: "✅ Posted Successfully 🚀",
        reply_markup: mainMenu(isAdmin)
      });

      delete db.users[chat].state;
    }

    saveDB(db);
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Bot Running..."));
