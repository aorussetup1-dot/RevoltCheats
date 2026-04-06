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

const CHANNELS = [
  "-1003360024342",
  "-1002219330498"
];

// ===== STORAGE =====
const DB_FILE = "data.json";

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    users: {},
    captions: {
      non_root: "Non Root Loader 🔥",
      root: "Root Loader ⚡",
      kernel: "Kernel Loader 💀"
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

    // START
    if (text === "/start") {
      await send("sendMessage", {
        chat_id: chat,
        text: "Select Mode 👇",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Non Root", callback_data: "non_root" },
              { text: "Root", callback_data: "root" }
            ],
            [
              { text: "Kernel", callback_data: "kernel" }
            ],
            [
              { text: "Edit Caption", callback_data: "edit" }
            ]
          ]
        }
      });
    }

    // PHOTO
    if (msg.photo) {
      const state = db.users[chat]?.state;
      if (!state) return;

      const photo = msg.photo[msg.photo.length - 1].file_id;
      const caption = db.captions[state] || "Uploaded";

      for (let ch of CHANNELS) {
        await send("sendPhoto", {
          chat_id: ch,
          photo: photo,
          caption: caption
        });
      }

      delete db.users[chat];

      await send("sendMessage", {
        chat_id: chat,
        text: "✅ Posted to channels"
      });

      saveDB(db);
    }

    // EDIT CAPTION
    if (text && msg.from.id === ADMIN_ID) {
      const state = db.users[chat]?.state;

      if (state === "edit" && text.includes(":")) {
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

        saveDB(db);
      }
    }
  }

  // ===== CALLBACK =====
  if (update.callback_query) {
    const cb = update.callback_query;
    const chat = cb.message.chat.id;
    const user = cb.from.id;
    const data = cb.data;

    if (data === "edit") {
      if (user !== ADMIN_ID) return;

      db.users[chat] = { state: "edit" };

      await send("sendMessage", {
        chat_id: chat,
        text: "Send like:\nnon_root: caption"
      });

    } else {
      db.users[chat] = { state: data };

      await send("sendMessage", {
        chat_id: chat,
        text: "📸 Send photo"
      });
    }

    saveDB(db);
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Bot running..."));
