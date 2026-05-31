import TelegramBot from "node-telegram-bot-api";
import { logger } from "./lib/logger";

const token = process.env["TELEGRAM_BOT_TOKEN"];
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is required but was not provided.");
}

const STANDARD_CHANNELS = [
  { name: "заробіток на завданнях👇", id: -1003784403188 },
  { name: "чат взаємодопомоги👇",     id: -1003945914469 },
  { name: "відео-туторіали👇",         id: -1003985047416 },
  { name: "відгуки👇",                 id: -1003921025455 },
];

const PREMIUM_CHANNELS = [
  { name: "заробіток на завданнях👇", id: -1003784403188 },
  { name: "чат взаємодопомоги👇",     id: -1003945914469 },
  { name: "відео-туторіали👇",         id: -1003985047416 },
  { name: "відгуки👇",                 id: -1003921025455 },
  { name: "навчання кураторству👇",    id: -1003891371444 },
  { name: "продаж у тік ток👇",        id: -1003981697155 },
  { name: "продаж у інстаграм👇",      id: -1004293443484 },
  { name: "досягення👇",               id: -1003724183247 },
  { name: "піар👇",                    id: -1003967628563 },
];

type UserState = "awaiting_tariff" | "awaiting_report";
type Tariff = "standard" | "premium";

interface UserSession {
  state: UserState;
  tariff?: Tariff;
}

const ADMIN_ID = 6003178436;

const sessions = new Map<number, UserSession>();

async function generateInviteLinks(
  bot: TelegramBot,
  channels: { name: string; id: number }[]
): Promise<{ name: string; url: string }[]> {
  const expireDate = Math.floor(Date.now() / 1000) + 5 * 60;
  const results: { name: string; url: string }[] = [];

  for (const ch of channels) {
    try {
      const link = await (bot as any).createChatInviteLink(ch.id, {
        expire_date: expireDate,
        member_limit: 1,
      });
      results.push({ name: ch.name, url: link.invite_link });
    } catch (err: any) {
      logger.error({ err, channelId: ch.id }, "Failed to create invite link");
      results.push({ name: ch.name, url: "❌ помилка (бот не адмін?)" });
    }
  }

  return results;
}

export function startBot() {
  const bot = new TelegramBot(token, { polling: true });

  logger.info("Telegram bot started (polling)");

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    sessions.set(chatId, { state: "awaiting_tariff" });

    bot.sendMessage(
      chatId,
      'Вітаємо у боті каналу „VECTRA"🤍\n\nДля початку виберіть тариф:',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "STANDARD", callback_data: "tariff_standard" },
              { text: "PREMIUM", callback_data: "tariff_premium" },
            ],
          ],
        },
      }
    );
  });

  bot.onText(/\/chatid/, (msg) => {
    const chatId = msg.chat.id;
    const title = msg.chat.title ?? msg.chat.username ?? "цей чат";
    bot.sendMessage(chatId, `ID каналу «${title}»:\n<code>${chatId}</code>`, { parse_mode: "HTML" });
  });

  bot.on("callback_query", (query) => {
    const chatId = query.message?.chat.id;
    if (!chatId) return;

    const session = sessions.get(chatId);
    if (!session || session.state !== "awaiting_tariff") {
      bot.answerCallbackQuery(query.id);
      return;
    }

    const tariff: Tariff =
      query.data === "tariff_premium" ? "premium" : "standard";
    const tariffName = tariff === "premium" ? "PREMIUM" : "STANDARD";

    sessions.set(chatId, { state: "awaiting_report", tariff });

    bot.answerCallbackQuery(query.id, { text: `Обрано тариф: ${tariffName}` });

    bot.sendMessage(
      chatId,
      `Тепер пришліть звіт у такому форматі:\n\n1. Фото переказу грошей вашим учнем на ваш банк\n2. Напишіть нікнейм учня (@) або імʼя\n3. Напишіть який тариф ви продали\n\n❗️Все повинно бути відправлене одним повідомленням`
    );
  });

  bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    if (msg.text?.startsWith("/")) return;

    const session = sessions.get(chatId);
    if (!session || session.state !== "awaiting_report") return;

    const tariff = session.tariff;
    sessions.delete(chatId);

    if (!tariff) return;

    const channels = tariff === "premium" ? PREMIUM_CHANNELS : STANDARD_CHANNELS;
    const tariffName = tariff === "premium" ? "PREMIUM" : "STANDARD";

    const senderName = msg.from?.username
      ? `@${msg.from.username}`
      : msg.from?.first_name ?? "Невідомий";

    bot.forwardMessage(ADMIN_ID, chatId, msg.message_id);
    bot.sendMessage(
      ADMIN_ID,
      `📋 Новий звіт від ${senderName}\nТариф: ${tariffName}`
    );

    bot.sendMessage(chatId, "Звіт відправлено, дякуємо🤍\n\nГенерую ваші одноразові посилання...").then(() => {
      generateInviteLinks(bot, channels).then((links) => {
        const linksText = links.map((l) => `${l.name}\n${l.url}`).join("\n\n");

        bot
          .sendMessage(
            chatId,
            `Ваші посилання для тарифу ${tariffName}:\n\n${linksText}\n\n⚠️ Посилання одноразові і діють 5 хвилин`
          )
          .then((sent) => {
            setTimeout(() => {
              bot.deleteMessage(chatId, sent.message_id).catch(() => {});
            }, 5 * 60 * 1000);
          });
      });
    });
  });

  bot.on("polling_error", (err) => {
    logger.error({ err }, "Telegram polling error");
  });

  return bot;
}
