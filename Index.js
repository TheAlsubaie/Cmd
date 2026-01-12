const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} = require("discord.js");

const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

let panelChannelId = null;

/* ================= IMAGE GENERATOR ================= */
async function generateImage(roles) {
  const bg = await loadImage("./background.png");

  const canvas = createCanvas(bg.width, bg.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(bg, 0, 0);

  const box = 90;
  const gap = 20;
  const startX = 40;
  const startY = 60;

  ctx.font = "bold 40px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  roles.forEach((role, i) => {
    const x = startX + (i % 11) * (box + gap);
    const y = startY + Math.floor(i / 11) * (box + gap);

    const color = role.color;

    ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    ctx.beginPath();
    ctx.roundRect(x, y, box, box, 18);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.fillText(role.name, x + box / 2, y + box / 2);
  });

  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync("colors.png", buffer);
}
/* =================================================== */

client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith("!color")) return;
  if (!msg.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  const channel = msg.mentions.channels.first();
  if (!channel) return;

  panelChannelId = channel.id;
  msg.reply(`تم تحديد الروم ${channel}`);
});

async function updatePanel() {
  if (!panelChannelId) return;

  const channel = await client.channels.fetch(panelChannelId);
  const guild = channel.guild;

  let roles = guild.roles.cache
    .filter(r =>
      /^\d+$/.test(r.name) &&
      r.color !== 0
    )
    .sort((a, b) => Number(a.name) - Number(b.name))
    .toJSON();

  if (!roles.length) return;

  await channel.bulkDelete(100).catch(() => {});

  await generateImage(roles);

  const file = new AttachmentBuilder("./colors.png");

  const rows = [];
  let row = new ActionRowBuilder();

  roles.forEach((role, i) => {
    const btn = new ButtonBuilder()
      .setCustomId(`color_${role.id}`)
      .setLabel(role.name)
      .setStyle(ButtonStyle.Secondary);

    row.addComponents(btn);

    if ((i + 1) % 5 === 0) {
      rows.push(row);
      row = new ActionRowBuilder();
    }
  });

  if (row.components.length) rows.push(row);

  await channel.send({ files: [file], components: rows });
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith("color_")) return;

  const roleId = interaction.customId.split("_")[1];
  const role = interaction.guild.roles.cache.get(roleId);

  if (!role) return;

  const member = interaction.member;

  const colorRoles = interaction.guild.roles.cache.filter(r => /^\d+$/.test(r.name));
  await member.roles.remove(colorRoles);

  await member.roles.add(role);
  await interaction.deferUpdate();
});

client.once("ready", () => {
  console.log("Bot Ready");
  setInterval(updatePanel, 5 * 60 * 1000);
});

client.login(TOKEN);
