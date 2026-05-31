import TelegramBot from "node-telegram-bot-api";
import { logger } from "./lib/logger";

const token = process.env["TELEGRAM_BOT_TOKEN"];
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is required but was not provided.");
}

const STANDARD_LINKS = [
  { name: "заробіток на завданнях👇", url: "https://t.me/+frma8U34CSEwYjYy" },
  { name: "чат взаємодопомоги👇", url: "https://t.me/+5vpSc3qIvHg3NDcy" },
  { name: "відео-туторіали👇", url: "https://t.me/+4jifbA6s241hYTc6" },
  { name: "відгуки👇", url: "https://t.me/+pia9L0QSkj5jMGNi" },
];

const PREMIUM_LINKS = [
  { name: "навчання кураторству👇", url: "https://t.me/+WqEAsQvW_lYxMjAy" },
  { name: "продаж у тік ток👇", url: "https://t.me/+8y4We7nhFL4xZWRi" },
  { name: "продаж у інстаграм👇", url: "https://t.me/+7sEp_jENkDIxZjcy" },
  { name: "досягення👇", url: "https://t.me/+uPMLWjsXK8A3YzI6" },
  { name: "піар👇", url: "https://t.me/+T4DE_oUbwY9jMTJi" },
  { name: "відгуки👇", url: "https://t.me/+pia9L0QSkj5jMGNi" },
  { name: "відео-туторіали👇", url: "https://t.me/+4jifbA6s241hYTc6" },
  { name: "чат взаємодопомоги👇", url: "https://t.me/+5vpSc3qIvHg3NDcy" },
  { name: "заробіток на завданнях👇", url: "https://t.me/+frma8U34CSEwYjYy" },
];

type UserState = "awaiting_tariff" | "awaiting_report";
type Tariff = "standard" | "premium";

interface UserSession {
  state: UserState;
  tariff?: Tariff;
}

const ADMIN_ID = 6003178436;

const sessions = new Map<number, UserSession>();

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

    const links = tariff === "premium" ? PREMIUM_LINKS : STANDARD_LINKS;
    const tariffName = tariff === "premium" ? "PREMIUM" : "STANDARD";

    const linksText = links.map((l) => `${l.name}\n${l.url}`).join("\n\n");

    const senderName = msg.from?.username
      ? `@${msg.from.username}`
      : msg.from?.first_name ?? "Невідомий";

    bot.forwardMessage(ADMIN_ID, chatId, msg.message_id);
    bot.sendMessage(
      ADMIN_ID,
      `📋 Новий звіт від ${senderName}\nТариф: ${tariffName}`
    );

    bot.sendMessage(
      chatId,
      `Звіт відправлено, дякуємо🤍\n\nВаші посилання для тарифу ${tariffName}:\n\n${linksText}`
    ).then((sent) => {
      setTimeout(() => {
        bot.deleteMessage(chatId, sent.message_id).catch(() => {});
      }, 5 * 60 * 1000);
    });
  });

  bot.on("polling_error", (err) => {
    logger.error({ err }, "Telegram polling error");
  });

  return bot;
}
