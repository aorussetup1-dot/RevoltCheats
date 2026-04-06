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
      non_root: "🔥 Non Root Loader",
      root: "⚡ Root Loader",
      kernel: "💀 Kernel Loader"
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

// ===== KEYBOARDS =====
function mainMenu(isAdmin = false) {
  let keyboard = [
    ["📱 Non Root", "⚡ Root"],
    ["💀 Kernel"]
  ];

  if (isAdmin) {
    keyboard.push(["⚙️ Admin Panel"]);
  }

  return {
    keyboard,
    resize_keyboard: true
  };
}

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

// ===== WEBHOOK =====
app.post("/", async (req, res) => {
  res.sendStatus(200);

  const update = req.body;
  let db = loadDB();

  // ===== MESSAGE =====
  if (update.message) {
    const msg = update.message;
    const chat = msg.chat.id;
    const text = msg.text;
    const isAdmin = msg.from.id === ADMIN_ID;

    // ===== START =====
    if (text === "/start") {
      await send("sendMessage", {
        chat_id: chat,
        text: "👋 Welcome!\n\nSelect Mode 👇",
        reply_markup: mainMenu(isAdmin)
      });
    }

    // ===== MENU HANDLING =====
    if (text === "📱 Non Root") {
      db.users[chat] = { state: "non_root" };

      await send("sendMessage", {
        chat_id: chat,
        text: "📸 Send your photo for *Non Root Loader*",
        parse_mode: "Markdown"
      });
    }

    if (text === "⚡ Root") {
      db.users[chat] = { state: "root" };

      await send("sendMessage", {
        chat_id: chat,
        text: "📸 Send your photo for *Root Loader*",
        parse_mode: "Markdown"
      });
    }

    if (text === "💀 Kernel") {
      db.users[chat] = { state: "kernel" };

      await send("sendMessage", {
        chat_id: chat,
        text: "📸 Send your photo for *Kernel Loader*",
        parse_mode: "Markdown"
      });
    }

    // ===== ADMIN PANEL =====
    if (text === "⚙️ Admin Panel" && isAdmin) {
      await send("sendMessage", {
        chat_id: chat,
        text: "⚙️ Admin Controls",
        reply_markup: adminMenu()
      });
    }

    if (text === "🔙 Back") {
      await send("sendMessage", {
        chat_id: chat,
        text: "⬅️ Back to Menu",
        reply_markup: mainMenu(isAdmin)
      });
    }

    // ===== VIEW CHANNELS =====
    if (text === "📊 View Channels" && isAdmin) {
      let list = db.channels.map((c, i) => `${i + 1}. ${c}`).join("\n");

      await send("sendMessage", {
        chat_id: chat,
        text: `📢 Channels:\n\n${list || "No channels"}`
      });
    }

    // ===== ADD CHANNEL =====
    if (text === "➕ Add Channel" && isAdmin) {
      db.users[chat] = { state: "add_channel" };

      await send("sendMessage", {
        chat_id: chat,
        text: "Send Channel ID to add:"
      });
    }

    if (db.users[chat]?.state === "add_channel" && text && isAdmin) {
      if (!db.channels.includes(text)) {
        db.channels.push(text);

        await send("sendMessage", {
          chat_id: chat,
          text: "✅ Channel Added"
        });
      }
      delete db.users[chat];
    }

    // ===== REMOVE CHANNEL =====
    if (text === "➖ Remove Channel" && isAdmin) {
      db.users[chat] = { state: "remove_channel" };

      await send("sendMessage", {
        chat_id: chat,
        text: "Send Channel ID to remove:"
      });
    }

    if (db.users[chat]?.state === "remove_channel" && text && isAdmin) {
      db.channels = db.channels.filter(c => c !== text);

      await send("sendMessage", {
        chat_id: chat,
        text: "❌ Channel Removed"
      });

      delete db.users[chat];
    }

    // ===== EDIT CAPTION =====
    if (text === "✏️ Edit Caption" && isAdmin) {
      db.users[chat] = { state: "edit_caption" };

      await send("sendMessage", {
        chat_id: chat,
        text: "Send like:\n\nnon_root: Your Caption"
      });
    }

    if (db.users[chat]?.state === "edit_caption" && text && isAdmin) {
      if (text.includes(":")) {
        let [k, v] = text.split(":", 2);
        k = k.trim();
        v = v.trim();

        if (db.captions[k]) {
          db.captions[k] = v;

          await send("sendMessage", {
            chat_id: chat,
            text: `✅ Updated ${k}`
          });
        }
      }
      delete db.users[chat];
    }

    // ===== PHOTO =====
    if (msg.photo) {
      const state = db.users[chat]?.state;
      if (!state) return;

      const photo = msg.photo[msg.photo.length - 1].file_id;
      const caption = db.captions[state];

      for (let ch of db.channels) {
        await send("sendPhoto", {
          chat_id: ch,
          photo: photo,
          caption: caption
        });
      }

      delete db.users[chat];

      await send("sendMessage", {
        chat_id: chat,
        text: "✅ Posted Successfully 🚀",
        reply_markup: mainMenu(isAdmin)
      });
    }

    saveDB(db);
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Bot Running..."));
