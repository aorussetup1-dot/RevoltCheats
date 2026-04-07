const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(bodyParser.json());

// ===== CONFIG =====
const MAIN_TOKEN = "8747945915:AAHLdExgedeAdwWK1c6LZ8Rh6hcj3VJgAHI";
const BASE_URL = "https://revoltcheats.onrender.com"; // CHANGE
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

const loadDB = () => JSON.parse(fs.readFileSync(DB_FILE));
const saveDB = (d) => fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2));

const send = (token, method, data) =>
  axios.post(`https://api.telegram.org/bot${token}/${method}`, data);

// ===== MENU =====
const mainMenu = () => ({
  keyboard: [["🤖 Create Bot"], ["📊 My Bot"]],
  resize_keyboard: true
});

// ===== MAIN BOT =====
app.post("/", async (req, res) => {
  res.sendStatus(200);

  const db = loadDB();
  const msg = req.body.message;
  if (!msg) return;

  const chat = msg.chat.id;
  const text = msg.text;
  db.users[chat] ||= {};

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
    db.users[chat].state = "token";
    saveDB(db);

    await send(MAIN_TOKEN, "sendMessage", {
      chat_id: chat,
      text: "🔑 Send Bot Token"
    });
    return;
  }

  // TOKEN INPUT
  if (db.users[chat].state === "token") {
    if (!text || !text.includes(":") || text.length < 30) {
      await send(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "❌ Invalid Token"
      });
      return;
    }

    try {
      const check = await axios.get(`https://api.telegram.org/bot${text}/getMe`);
      if (!check.data.ok) throw "err";

      db.tempToken[chat] = text;
      db.users[chat].state = "admin";
      saveDB(db);

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
    return;
  }

  // ADMIN ID
  if (db.users[chat].state === "admin") {
    if (!text || isNaN(text)) {
      await send(MAIN_TOKEN, "sendMessage", {
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
      modes: {},
      state: {},
      stats: { posts: 0 },
      logs: []
    };

    await axios.get(
      `https://api.telegram.org/bot${token}/setWebhook?url=${BASE_URL}/${token}`
    );

    delete db.tempToken[chat];
    delete db.users[chat].state;
    saveDB(db);

    await send(MAIN_TOKEN, "sendMessage", {
      chat_id: chat,
      text: "✅ Bot Created Successfully 🚀"
    });
    return;
  }

  // ===== MY BOT =====
  if (text === "📊 My Bot") {
    const token = db.bots[chat];

    if (!token) {
      await send(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "❌ No bot created yet"
      });
      return;
    }

    try {
      const info = await axios.get(`https://api.telegram.org/bot${token}/getMe`);

      await send(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text:
`🤖 Your Bot

👤 ${info.data.result.first_name}
🔗 @${info.data.result.username}
🆔 ${info.data.result.id}

✅ Active`
      });
    } catch {
      await send(MAIN_TOKEN, "sendMessage", {
        chat_id: chat,
        text: "⚠️ Bot not responding"
      });
    }
  }
});

// ===== CLONE BOT =====
app.post("/:token", async (req, res) => {
  res.sendStatus(200);

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

  // ADMIN CHECK
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
      text: "alias - caption"
    });
    return;
  }

  if (config.state[user].mode === "add") {
    if (!text.includes("-")) {
      await sendBot("sendMessage", {
        chat_id: chat,
        text: "❌ Format: alias - caption"
      });
      return;
    }

    let [a, ...b] = text.split("-");
    config.modes[a.trim().toLowerCase()] = b.join("-").trim();

    delete config.state[user].mode;
    saveDB(db);

    await sendBot("sendMessage", {
      chat_id: chat,
      text: "✅ Mode added",
      reply_markup: menu()
    });
    return;
  }

  // DELETE MODE
  if (text === "❌ Delete Mode") {
    config.state[user].mode = "delete";

    await sendBot("sendMessage", {
      chat_id: chat,
      text: "Send mode name"
    });
    return;
  }

  if (config.state[user].mode === "delete") {
    delete config.modes[text];
    delete config.state[user].mode;
    saveDB(db);

    await sendBot("sendMessage", {
      chat_id: chat,
      text: "Deleted",
      reply_markup: menu()
    });
    return;
  }

  // ADD CHANNEL
  if (text === "📢 Add Channel") {
    config.state[user].mode = "channel";

    await sendBot("sendMessage", {
      chat_id: chat,
      text: "Send channel ID"
    });
    return;
  }

  if (config.state[user].mode === "channel") {
    config.channels.push(text);
    delete config.state[user].mode;
    saveDB(db);

    await sendBot("sendMessage", {
      chat_id: chat,
      text: "Channel added",
      reply_markup: menu()
    });
    return;
  }

  // SELECT MODE
  if (config.modes[text]) {
    config.state[user] = { post: text, media: [] };

    await sendBot("sendMessage", {
      chat_id: chat,
      text: "Send photos then DONE"
    });
    return;
  }

  // COLLECT PHOTOS
  if (msg.photo && config.state[user].media) {
    config.state[user].media.push(
      msg.photo[msg.photo.length - 1].file_id
    );

    await sendBot("sendMessage", {
      chat_id: chat,
      text: "Added"
    });
    return;
  }

  // POST
  if (text === "DONE" && config.state[user].media) {
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
      text: "✅ Posted Successfully 🚀",
      reply_markup: menu()
    });
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

// ===== WEB =====
app.get("/", (req, res) => {
  res.send("🚀 Bot Running");
});

app.listen(3000, () => console.log("🚀 Server Running"));
