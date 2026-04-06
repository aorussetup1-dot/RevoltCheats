const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(bodyParser.json());

// ===== CONFIG =====
const TOKEN = "PUT_YOUR_TOKEN";
const API = `https://api.telegram.org/bot${TOKEN}`;
const ADMIN_ID = 1953766793;

const DB_FILE = "data.json";

// ===== INIT DB =====
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    users: {},
    channels: [
      "-1003360024342",
      "-1002219330498"
    ],
    captions: {
      non_root: "🔥 Non Root Loader",
      root: "⚡ Root Loader",
      kernel: "💀 Kernel Loader"
    }
  }, null, 2));
}

const loadDB = () => JSON.parse(fs.readFileSync(DB_FILE));
const saveDB = (d) => fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2));

// ===== API =====
async function send(method, data) {
  try {
    await axios.post(`${API}/${method}`, data);
  } catch (e) {
    console.log("ERR:", e.response?.data || e.message);
  }
}

// ===== KEYBOARDS =====
function mainMenu() {
  return {
    keyboard: [
      ["📱 Non Root", "🔓 Root"],
      ["⚙️ Kernel"],
      ["✏️ Edit Caption"]
    ],
    resize_keyboard: true
  };
}

function adminMenu() {
  return {
    keyboard: [
      ["➕ Add Channel", "➖ Remove Channel"],
      ["📋 Show Channels"],
      ["⬅️ Back"]
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

    const state = db.users[chat]?.state;

    // ===== START =====
    if (text === "/start") {
      await send("sendMessage", {
        chat_id: chat,
        text: "🔥 Welcome to Revolt Bot\nSelect Mode 👇",
        reply_markup: mainMenu()
      });
    }

    // ===== ADMIN PANEL =====
    if (text === "/admin" && msg.from.id === ADMIN_ID) {
      db.users[chat] = { state: "admin" };

      await send("sendMessage", {
        chat_id: chat,
        text: "⚙️ Admin Panel",
        reply_markup: adminMenu()
      });
    }

    // ===== CHANNEL ADD =====
    if (text === "➕ Add Channel" && msg.from.id === ADMIN_ID) {
      db.users[chat] = { state: "add_channel" };

      return send("sendMessage", {
        chat_id: chat,
        text: "Send Channel ID"
      });
    }

    if (state === "add_channel" && msg.from.id === ADMIN_ID) {
      if (!db.channels.includes(text)) {
        db.channels.push(text);
        saveDB(db);

        return send("sendMessage", {
          chat_id: chat,
          text: "✅ Channel Added"
        });
      }
    }

    // ===== REMOVE CHANNEL =====
    if (text === "➖ Remove Channel" && msg.from.id === ADMIN_ID) {
      db.users[chat] = { state: "remove_channel" };

      return send("sendMessage", {
        chat_id: chat,
        text: "Send Channel ID to remove"
      });
    }

    if (state === "remove_channel" && msg.from.id === ADMIN_ID) {
      db.channels = db.channels.filter(c => c !== text);
      saveDB(db);

      return send("sendMessage", {
        chat_id: chat,
        text: "❌ Channel Removed"
      });
    }

    // ===== SHOW CHANNELS =====
    if (text === "📋 Show Channels" && msg.from.id === ADMIN_ID) {
      return send("sendMessage", {
        chat_id: chat,
        text: "Channels:\n" + db.channels.join("\n")
      });
    }

    // ===== MODE SELECT =====
    if (text === "📱 Non Root" || text === "🔓 Root" || text === "⚙️ Kernel") {
      let type = text.includes("Non") ? "non_root" :
                 text.includes("Root") ? "root" : "kernel";

      db.users[chat] = { state: type };

      saveDB(db);

      return send("sendMessage", {
        chat_id: chat,
        text: "📸 Send Photo"
      });
    }

    // ===== EDIT CAPTION =====
    if (text === "✏️ Edit Caption" && msg.from.id === ADMIN_ID) {
      db.users[chat] = { state: "edit_caption" };

      return send("sendMessage", {
        chat_id: chat,
        text: "Send:\nnon_root: caption"
      });
    }

    if (state === "edit_caption" && msg.from.id === ADMIN_ID) {
      if (text.includes(":")) {
        let [k, v] = text.split(":", 2);
        k = k.trim(); v = v.trim();

        if (db.captions[k]) {
          db.captions[k] = v;
          saveDB(db);

          return send("sendMessage", {
            chat_id: chat,
            text: "✅ Updated"
          });
        }
      }
    }

    // ===== PHOTO =====
    if (msg.photo) {
      const st = db.users[chat]?.state;
      if (!st) return;

      const photo = msg.photo[msg.photo.length - 1].file_id;
      const caption = db.captions[st];

      for (let ch of db.channels) {
        await send("sendPhoto", {
          chat_id: ch,
          photo,
          caption
        });
      }

      delete db.users[chat];
      saveDB(db);

      return send("sendMessage", {
        chat_id: chat,
        text: "✅ Posted Successfully"
      });
    }
  }
});

// ===== HEALTH =====
app.get("/", (req, res) => res.send("🔥 Revolt Bot Running"));

// ===== START =====
app.listen(process.env.PORT || 3000);
