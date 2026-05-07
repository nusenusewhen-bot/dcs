const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
require('dotenv').config();
const fs = require('fs');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

client.tickets = new Map();
client.settings = new Map();
client.autoSayTimers = new Map(); // guildId_channelId -> { message, interval, timer }
client.autoPingTimers = new Map(); // guildId_channelId -> { pingType, interval, timer }
client.afkUsers = new Map(); // userId -> { reason, originalNickname }
client.ticketActivity = new Map(); // channelId -> lastMessageTimestamp

const SETTINGS_FILE = './settings.json';
const AUTOSAY_FILE = './autosay.json';
const AUTOPING_FILE = './autoping.json';

// Load settings
try {
    if (fs.existsSync(SETTINGS_FILE)) {
        const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        for (const [guildId, settings] of Object.entries(saved)) {
            client.settings.set(guildId, settings);
        }
    }
} catch(e) {
    console.log('No saved settings found, starting fresh.');
}

// Load auto-say configs
try {
    if (fs.existsSync(AUTOSAY_FILE)) {
        const saved = JSON.parse(fs.readFileSync(AUTOSAY_FILE, 'utf-8'));
        for (const [key, config] of Object.entries(saved)) {
            client.autoSayTimers.set(key, config);
        }
    }
} catch(e) {
    console.log('No saved autosay configs found.');
}

// Load auto-ping configs
try {
    if (fs.existsSync(AUTOPING_FILE)) {
        const saved = JSON.parse(fs.readFileSync(AUTOPING_FILE, 'utf-8'));
        for (const [key, config] of Object.entries(saved)) {
            client.autoPingTimers.set(key, config);
        }
    }
} catch(e) {
    console.log('No saved autoping configs found.');
}

function saveSettings() {
    const obj = {};
    for (const [guildId, settings] of client.settings) {
        obj[guildId] = settings;
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(obj, null, 2));
}

function saveAutoSay() {
    const obj = {};
    for (const [key, config] of client.autoSayTimers) {
        // Don't save timer object, just config
        obj[key] = { message: config.message, interval: config.interval, guildId: config.guildId, channelId: config.channelId };
    }
    fs.writeFileSync(AUTOSAY_FILE, JSON.stringify(obj, null, 2));
}

function saveAutoPing() {
    const obj = {};
    for (const [key, config] of client.autoPingTimers) {
        obj[key] = { pingType: config.pingType, interval: config.interval, guildId: config.guildId, channelId: config.channelId };
    }
    fs.writeFileSync(AUTOPING_FILE, JSON.stringify(obj, null, 2));
}

const IMAGE_URL = 'https://i.postimg.cc/kXMZyyG5/IMG-4619.jpg';
const ADMIN_ROLE = process.env.ADMIN_ROLE_ID || '1463189207282356276';
const MIDDLEMAN_ROLE = process.env.MIDDLEMAN_ROLE_ID || '1494798337361186998';

function isAdmin(member) { 
    return member.roles.cache.has(ADMIN_ROLE) || member.permissions.has('Administrator'); 
}

function isMiddleman(member) { 
    return member.roles.cache.has(MIDDLEMAN_ROLE); 
}

function createPanelEmbed(title, desc) {
    return {
        color: 0xFF0000,
        title: title,
        description: desc,
        image: { url: IMAGE_URL },
        footer: { text: 'Z2U MarketPlace', icon_url: IMAGE_URL }
    };
}

function createTicketEmbed(title, fields) {
    return {
        color: 0xFF0000,
        title: title,
        fields: fields,
        footer: { text: 'Z2U MarketPlace' }
    };
}

function createMMBtns(id, claimed) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`claim_${id}`).setLabel('Claim').setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(claimed),
        new ButtonBuilder().setCustomId(`unclaim_${id}`).setLabel('Unclaim').setStyle(ButtonStyle.Danger).setDisabled(!claimed),
        new ButtonBuilder().setCustomId(`close_${id}`).setLabel('Close').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`adduser_${id}`).setLabel('Add User').setStyle(ButtonStyle.Primary)
    );
}

function createIndexBtns(id, claimed) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`idxclaim_${id}`).setLabel('Claim').setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(claimed),
        new ButtonBuilder().setCustomId(`idxunclaim_${id}`).setLabel('Unclaim').setStyle(ButtonStyle.Danger).setDisabled(!claimed),
        new ButtonBuilder().setCustomId(`idxclose_${id}`).setLabel('Close').setStyle(ButtonStyle.Danger)
    );
}

const commands = [
    new SlashCommandBuilder().setName('ticketpanel').setDescription('Spawn MM ticket panel').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).toJSON(),
    new SlashCommandBuilder().setName('indexpanel').setDescription('Spawn Base & Index ticket panel').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).toJSON(),
    new SlashCommandBuilder().setName('ticketcategory').setDescription('Set MM ticket category').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addStringOption(o => o.setName('id').setDescription('Category ID').setRequired(true)).toJSON(),
    new SlashCommandBuilder().setName('indexcategory').setDescription('Set Base & Index ticket category').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addStringOption(o => o.setName('id').setDescription('Category ID').setRequired(true)).toJSON(),
    new SlashCommandBuilder().setName('say').setDescription('Send message as bot').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true).addChannelTypes(ChannelType.GuildText)).addStringOption(o => o.setName('message').setDescription('Message').setRequired(true)).addStringOption(o => o.setName('ping').setDescription('Optional ping').setRequired(false).addChoices({name:'@everyone',value:'everyone'},{name:'@here',value:'here'})).addStringOption(o => o.setName('embed').setDescription('Send as embed? (y/n)').setRequired(false)).toJSON(),
    new SlashCommandBuilder().setName('autosay').setDescription('Send recurring message as bot (Admin only)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true).addChannelTypes(ChannelType.GuildText)).addStringOption(o => o.setName('message').setDescription('Message to send').setRequired(true)).addStringOption(o => o.setName('time').setDescription('Time interval (e.g. 1h, 30m, 1d)').setRequired(true)).toJSON(),
    new SlashCommandBuilder().setName('afk').setDescription('Set yourself as AFK').addStringOption(o => o.setName('reason').setDescription('AFK reason').setRequired(true)).toJSON(),
    new SlashCommandBuilder().setName('autoping').setDescription('Send recurring pings in channel (Admin only)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true).addChannelTypes(ChannelType.GuildText)).addStringOption(o => o.setName('ping').setDescription('Ping type').setRequired(true).addChoices({name:'@everyone',value:'everyone'},{name:'@here',value:'here'})).addStringOption(o => o.setName('time').setDescription('Time interval (e.g. 1h, 30m, 1d)').setRequired(true)).toJSON(),
    new SlashCommandBuilder().setName('rautoping').setDescription('Remove all auto pings from a channel (Admin only)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true).addChannelTypes(ChannelType.GuildText)).toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

// Parse time string like "1h", "30m", "1d" to milliseconds
function parseTime(str) {
    const match = str.match(/^(\d+)([smhd])$/i);
    if (!match) return null;
    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return num * multipliers[unit];
}

// Start auto-say timers from saved configs
function startSavedTimers() {
    for (const [key, config] of client.autoSayTimers) {
        if (config.timer) clearInterval(config.timer);
        const interval = parseTime(config.interval);
        if (!interval) continue;
        const timer = setInterval(async () => {
            const guild = client.guilds.cache.get(config.guildId);
            if (!guild) return;
            const channel = guild.channels.cache.get(config.channelId);
            if (!channel) return;
            try {
                await channel.send(config.message);
            } catch (e) {}
        }, interval);
        config.timer = timer;
    }

    for (const [key, config] of client.autoPingTimers) {
        if (config.timer) clearInterval(config.timer);
        const interval = parseTime(config.interval);
        if (!interval) continue;
        const timer = setInterval(async () => {
            const guild = client.guilds.cache.get(config.guildId);
            if (!guild) return;
            const channel = guild.channels.cache.get(config.channelId);
            if (!channel) return;
            try {
                const msg = await channel.send(config.pingType === 'everyone' ? '@everyone' : '@here');
                setTimeout(() => msg.delete().catch(() => {}), 100);
            } catch (e) {}
        }, interval);
        config.timer = timer;
    }
}

// Check for inactive tickets (12 hours = 43200000 ms)
function checkInactiveTickets() {
    const now = Date.now();
    const twelveHours = 43200000;
    for (const [channelId, lastActivity] of client.ticketActivity) {
        if (now - lastActivity > twelveHours) {
            // Find and close the ticket
            for (const [id, data] of client.tickets) {
                if (data.channelId === channelId) {
                    const guild = client.guilds.cache.find(g => g.channels.cache.has(channelId));
                    if (guild) {
                        const ch = guild.channels.cache.get(channelId);
                        if (ch) {
                            ch.delete('Closed due to inactivity (12 hours)').catch(() => {});
                        }
                    }
                    client.tickets.delete(id);
                    client.ticketActivity.delete(channelId);
                    break;
                }
            }
        }
    }
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('Z2U MarketPlace', { type: 3 });
    const guildId = process.env.GUILD_ID;
    try {
        if (guildId) {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
            console.log(`Guild commands registered for ${guildId}`);
        } else {
            await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
            console.log('Global commands registered.');
        }
    } catch (e) {
        console.error('Failed to register commands:', e.message);
        console.log('Re-invite bot with applications.commands scope:');
        console.log(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot+applications.commands`);
    }

    startSavedTimers();

    // Check inactive tickets every 5 minutes
    setInterval(checkInactiveTickets, 300000);
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;
            if (commandName === 'ticketpanel') {
                await interaction.reply({ content: 'Ticket panel spawned!', flags: MessageFlags.Ephemeral });
                const embed = createPanelEmbed('__Z2U MarketPlace MM__', 'Welcome to Z2U MarketPlace Middleman Service.\nPlease wait patiently for support and try not to ping. Our service is trusted by thousands and we hope we could expand our services so we could encourage other people to start middleman services like us!\n\n- Allowed Ping 1 time\n- Wait patiently\n- Be respectful to staff/middlemen\n\nAny type of fraud will be taken to extreme level which will cause an instant ban with blacklist!\n\nThanks for reading this.');
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('spawn_mm').setLabel('Create Ticket').setStyle(ButtonStyle.Success));
                await interaction.channel.send({ embeds: [embed], components: [row] });
            }
            else if (commandName === 'indexpanel') {
                await interaction.reply({ content: 'Base & Index panel spawned!', flags: MessageFlags.Ephemeral });
                const embed = createPanelEmbed('Base & Index Request - Z2U MarketPlace!', 'Welcome to our Base & Index service, we provide indexes and base skins. To purchase an index or a base skin, create a ticket and wait patiently for an answer.\n\n- Always you go first\n- Listen to the middleman\n- Any type of fraud is instant ban\n\nThanks for using our service!');
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('spawn_idx').setLabel('Create Base & Index Ticket').setStyle(ButtonStyle.Success));
                await interaction.channel.send({ embeds: [embed], components: [row] });
            }
            else if (commandName === 'ticketcategory') {
                const id = interaction.options.getString('id');
                const cat = interaction.guild.channels.cache.get(id);
                if (!cat || cat.type !== 4) return interaction.reply({ content: 'Invalid category ID!', flags: MessageFlags.Ephemeral });
                if (!client.settings.has(interaction.guild.id)) client.settings.set(interaction.guild.id, {});
                client.settings.get(interaction.guild.id).ticketCategory = id;
                saveSettings();
                await interaction.reply({ content: `MM category set to **${cat.name}**`, flags: MessageFlags.Ephemeral });
            }
            else if (commandName === 'indexcategory') {
                const id = interaction.options.getString('id');
                const cat = interaction.guild.channels.cache.get(id);
                if (!cat || cat.type !== 4) return interaction.reply({ content: 'Invalid category ID!', flags: MessageFlags.Ephemeral });
                if (!client.settings.has(interaction.guild.id)) client.settings.set(interaction.guild.id, {});
                client.settings.get(interaction.guild.id).indexCategory = id;
                saveSettings();
                await interaction.reply({ content: `Base & Index category set to **${cat.name}**`, flags: MessageFlags.Ephemeral });
            }
            else if (commandName === 'say') {
                const ch = interaction.options.getChannel('channel');
                let msg = interaction.options.getString('message');
                const ping = interaction.options.getString('ping');
                const embedOpt = interaction.options.getString('embed');
                if (ping === 'everyone') msg = '@everyone ' + msg;
                else if (ping === 'here') msg = '@here ' + msg;
                if (embedOpt && embedOpt.toLowerCase() === 'y') {
                    const embed = { color: 0xFF0000, description: msg, footer: { text: 'Z2U MarketPlace' } };
                    await ch.send({ embeds: [embed] });
                } else {
                    await ch.send(msg);
                }
                await interaction.reply({ content: `Sent to ${ch}`, flags: MessageFlags.Ephemeral });
            }
            else if (commandName === 'autosay') {
                const ch = interaction.options.getChannel('channel');
                const msg = interaction.options.getString('message');
                const timeStr = interaction.options.getString('time');
                const interval = parseTime(timeStr);
                if (!interval) return interaction.reply({ content: 'Invalid time format! Use format like: 30m, 1h, 2d', flags: MessageFlags.Ephemeral });

                const key = `${interaction.guild.id}_${ch.id}`;

                // Clear existing timer if any
                if (client.autoSayTimers.has(key)) {
                    const old = client.autoSayTimers.get(key);
                    if (old.timer) clearInterval(old.timer);
                }

                const timer = setInterval(async () => {
                    try {
                        await ch.send(msg);
                    } catch (e) {}
                }, interval);

                client.autoSayTimers.set(key, { message: msg, interval: timeStr, timer, guildId: interaction.guild.id, channelId: ch.id });
                saveAutoSay();

                await interaction.reply({ content: `Auto-say set in ${ch} every ${timeStr}.`, flags: MessageFlags.Ephemeral });
            }
            else if (commandName === 'afk') {
                const reason = interaction.options.getString('reason');
                const member = interaction.member;

                if (client.afkUsers.has(interaction.user.id)) {
                    return interaction.reply({ content: 'You are already AFK!', flags: MessageFlags.Ephemeral });
                }

                const originalNick = member.nickname || member.user.username;
                const afkNick = `[AFK] ${originalNick}`;

                try {
                    await member.setNickname(afkNick);
                } catch (e) {}

                client.afkUsers.set(interaction.user.id, { reason, originalNickname: originalNick, guildId: interaction.guild.id });
                await interaction.reply({ content: `You are now AFK: ${reason}`, flags: MessageFlags.Ephemeral });
            }
            else if (commandName === 'autoping') {
                const ch = interaction.options.getChannel('channel');
                const pingType = interaction.options.getString('ping');
                const timeStr = interaction.options.getString('time');
                const interval = parseTime(timeStr);
                if (!interval) return interaction.reply({ content: 'Invalid time format! Use format like: 30m, 1h, 2d', flags: MessageFlags.Ephemeral });

                const key = `${interaction.guild.id}_${ch.id}`;

                // Clear existing timer if any
                if (client.autoPingTimers.has(key)) {
                    const old = client.autoPingTimers.get(key);
                    if (old.timer) clearInterval(old.timer);
                }

                const timer = setInterval(async () => {
                    try {
                        const pingMsg = pingType === 'everyone' ? '@everyone' : '@here';
                        const msg = await ch.send(pingMsg);
                        setTimeout(() => msg.delete().catch(() => {}), 100);
                    } catch (e) {}
                }, interval);

                client.autoPingTimers.set(key, { pingType, interval: timeStr, timer, guildId: interaction.guild.id, channelId: ch.id });
                saveAutoPing();

                await interaction.reply({ content: `Auto-ping (${pingType}) set in ${ch} every ${timeStr}.`, flags: MessageFlags.Ephemeral });
            }
            else if (commandName === 'rautoping') {
                const ch = interaction.options.getChannel('channel');
                const key = `${interaction.guild.id}_${ch.id}`;

                if (client.autoPingTimers.has(key)) {
                    const config = client.autoPingTimers.get(key);
                    if (config.timer) clearInterval(config.timer);
                    client.autoPingTimers.delete(key);
                    saveAutoPing();
                    await interaction.reply({ content: `Removed auto-ping from ${ch}.`, flags: MessageFlags.Ephemeral });
                } else {
                    await interaction.reply({ content: `No auto-ping found in ${ch}.`, flags: MessageFlags.Ephemeral });
                }
            }
        }
        else if (interaction.isButton()) {
            const [action, ticketId] = interaction.customId.split('_');
            if (action === 'spawn' && ticketId === 'mm') {
                const modal = new ModalBuilder().setCustomId('mm_modal').setTitle('Middleman Ticket');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('trader').setLabel('User/ID Of Other Trader').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Description Of Trade').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rules').setLabel('Do you accept the rules?').setStyle(TextInputStyle.Short).setRequired(true))
                );
                await interaction.showModal(modal);
            }
            else if (action === 'spawn' && ticketId === 'idx') {
                const menu = new StringSelectMenuBuilder().setCustomId('idx_select').setPlaceholder('Select service type...').addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Index Service').setDescription('Purchase an index').setValue('index'),
                    new StringSelectMenuOptionBuilder().setLabel('Base Skin').setDescription('Purchase a base skin').setValue('skin')
                );
                await interaction.reply({ content: 'Select service type:', components: [new ActionRowBuilder().addComponents(menu)], flags: MessageFlags.Ephemeral });
            }
            else if (action === 'claim') {
                const data = client.tickets.get(ticketId);
                if (!data) return interaction.reply({ content: 'Ticket not found!', flags: MessageFlags.Ephemeral });
                if (!isMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', flags: MessageFlags.Ephemeral });
                if (data.claimed) return interaction.reply({ content: 'Already claimed!', flags: MessageFlags.Ephemeral });
                data.claimed = true; data.claimedBy = interaction.user.id; client.tickets.set(ticketId, data);
                const ch = interaction.guild.channels.cache.get(data.channelId);
                if (ch) await ch.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                const msg = await interaction.channel.messages.fetch(data.messageId);
                const fields = msg.embeds[0].fields.filter(f => f.name !== 'Claimed By');
                fields.push({ name: 'Claimed By', value: `<@${interaction.user.id}>`, inline: true });
                const emb = createTicketEmbed(`Ticket ${ticketId}`, fields);
                await msg.edit({ embeds: [emb], components: [createMMBtns(ticketId, true)] });
                await interaction.reply({ content: `Claimed by <@${interaction.user.id}>`, allowedMentions: { parse: [] } });
            }
            else if (action === 'unclaim') {
                const data = client.tickets.get(ticketId);
                if (!data) return interaction.reply({ content: 'Ticket not found!', flags: MessageFlags.Ephemeral });
                if (!isMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', flags: MessageFlags.Ephemeral });
                if (!data.claimed) return interaction.reply({ content: 'Not claimed!', flags: MessageFlags.Ephemeral });
                if (data.claimedBy !== interaction.user.id) return interaction.reply({ content: 'Only claimed MM!', flags: MessageFlags.Ephemeral });
                data.claimed = false; data.claimedBy = null; client.tickets.set(ticketId, data);
                const ch = interaction.guild.channels.cache.get(data.channelId);
                if (ch) await ch.permissionOverwrites.delete(interaction.user.id);
                const msg = await interaction.channel.messages.fetch(data.messageId);
                const fields = msg.embeds[0].fields.filter(f => f.name !== 'Claimed By');
                const emb = createTicketEmbed(`Ticket ${ticketId}`, fields);
                await msg.edit({ embeds: [emb], components: [createMMBtns(ticketId, false)] });
                await interaction.reply({ content: `Unclaimed by <@${interaction.user.id}>`, allowedMentions: { parse: [] } });
            }
            else if (action === 'close') {
                const data = client.tickets.get(ticketId);
                if (!data) return interaction.reply({ content: 'Ticket not found!', flags: MessageFlags.Ephemeral });
                if (!isMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', flags: MessageFlags.Ephemeral });
                const ch = interaction.guild.channels.cache.get(data.channelId);
                if (ch) await ch.delete('Closed');
                client.tickets.delete(ticketId);
                client.ticketActivity.delete(data.channelId);
                await interaction.reply({ content: 'Ticket closed.' });
            }
            else if (action === 'adduser') {
                const data = client.tickets.get(ticketId);
                if (!data) return interaction.reply({ content: 'Ticket not found!', flags: MessageFlags.Ephemeral });
                if (!isMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', flags: MessageFlags.Ephemeral });
                const modal = new ModalBuilder().setCustomId(`adduser_${ticketId}`).setTitle('Add User to Ticket');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('userid').setLabel('Username or ID').setStyle(TextInputStyle.Short).setRequired(true)));
                await interaction.showModal(modal);
            }
            else if (action === 'idxclaim') {
                const data = client.tickets.get(ticketId);
                if (!data) return interaction.reply({ content: 'Ticket not found!', flags: MessageFlags.Ephemeral });
                if (!isMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', flags: MessageFlags.Ephemeral });
                if (data.claimed) return interaction.reply({ content: 'Already claimed!', flags: MessageFlags.Ephemeral });
                data.claimed = true; data.claimedBy = interaction.user.id; client.tickets.set(ticketId, data);
                const ch = interaction.guild.channels.cache.get(data.channelId);
                if (ch) await ch.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                const msg = await interaction.channel.messages.fetch(data.messageId);
                const fields = msg.embeds[0].fields.filter(f => f.name !== 'Claimed By');
                fields.push({ name: 'Claimed By', value: `<@${interaction.user.id}>`, inline: true });
                const emb = createTicketEmbed(`Ticket ${ticketId}`, fields);
                await msg.edit({ embeds: [emb], components: [createIndexBtns(ticketId, true)] });
                await interaction.reply({ content: `Claimed by <@${interaction.user.id}>`, allowedMentions: { parse: [] } });
            }
            else if (action === 'idxunclaim') {
                const data = client.tickets.get(ticketId);
                if (!data) return interaction.reply({ content: 'Ticket not found!', flags: MessageFlags.Ephemeral });
                if (!isMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', flags: MessageFlags.Ephemeral });
                if (!data.claimed) return interaction.reply({ content: 'Not claimed!', flags: MessageFlags.Ephemeral });
                if (data.claimedBy !== interaction.user.id) return interaction.reply({ content: 'Only claimed MM!', flags: MessageFlags.Ephemeral });
                data.claimed = false; data.claimedBy = null; client.tickets.set(ticketId, data);
                const ch = interaction.guild.channels.cache.get(data.channelId);
                if (ch) await ch.permissionOverwrites.delete(interaction.user.id);
                const msg = await interaction.channel.messages.fetch(data.messageId);
                const fields = msg.embeds[0].fields.filter(f => f.name !== 'Claimed By');
                const emb = createTicketEmbed(`Ticket ${ticketId}`, fields);
                await msg.edit({ embeds: [emb], components: [createIndexBtns(ticketId, false)] });
                await interaction.reply({ content: `Unclaimed by <@${interaction.user.id}>`, allowedMentions: { parse: [] } });
            }
            else if (action === 'idxclose') {
                const data = client.tickets.get(ticketId);
                if (!data) return interaction.reply({ content: 'Ticket not found!', flags: MessageFlags.Ephemeral });
                if (!isMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', flags: MessageFlags.Ephemeral });
                const ch = interaction.guild.channels.cache.get(data.channelId);
                if (ch) await ch.delete('Closed');
                client.tickets.delete(ticketId);
                client.ticketActivity.delete(data.channelId);
                await interaction.reply({ content: 'Ticket closed.' });
            }
        }
        else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'idx_select') {
                const val = interaction.values[0];
                if (val === 'index') {
                    const modal = new ModalBuilder().setCustomId('idx_modal').setTitle('Index Service');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('what').setLabel('What are you indexing?').setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pay').setLabel('What are you paying?').setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('first').setLabel('Do you agree on going first?').setStyle(TextInputStyle.Short).setRequired(true))
                    );
                    await interaction.showModal(modal);
                } else if (val === 'skin') {
                    const modal = new ModalBuilder().setCustomId('skin_modal').setTitle('Base Skin');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('which').setLabel('Which base skin?').setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('payment').setLabel('Which payment?').setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('agree').setLabel('Do you agree on going first?').setStyle(TextInputStyle.Short).setRequired(true))
                    );
                    await interaction.showModal(modal);
                }
            }
        }
        else if (interaction.isModalSubmit()) {
            const guild = interaction.guild;
            const settings = client.settings.get(guild.id) || {};
            if (interaction.customId === 'mm_modal') {
                const cat = settings.ticketCategory;
                if (!cat) return interaction.reply({ content: 'Set category with /ticketcategory first!', flags: MessageFlags.Ephemeral });
                const trader = interaction.fields.getTextInputValue('trader');
                const desc = interaction.fields.getTextInputValue('desc');
                const rules = interaction.fields.getTextInputValue('rules');
                const num = (client.tickets.size + 1).toString().padStart(4, '0');
                const id = `mm-${num}`;
                const ch = await guild.channels.create({ name: `ticket-${id}`, type: ChannelType.GuildText, parent: cat, permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: MIDDLEMAN_ROLE, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                ]});
                const embed = createTicketEmbed(`Ticket ${id}`, [
                    { name: ':bust_in_silhouette: Creator', value: `<@${interaction.user.id}>`, inline: true },
                    { name: ':link: Other Trader', value: '\`\`\`' + trader + '\`\`\`', inline: true },
                    { name: ':memo: Description', value: desc },
                    { name: ':white_check_mark: Rules', value: rules, inline: true }
                ]);
                const msg = await ch.send({ content: `<@&${MIDDLEMAN_ROLE}>`, embeds: [embed], components: [createMMBtns(id, false)] });
                client.tickets.set(id, { channelId: ch.id, messageId: msg.id, creatorId: interaction.user.id, type: 'mm', claimed: false, claimedBy: null, addedUsers: [] });
                client.ticketActivity.set(ch.id, Date.now());
                await interaction.reply({ content: `Ticket created! <#${ch.id}>`, flags: MessageFlags.Ephemeral });
            }
            else if (interaction.customId.startsWith('adduser_')) {
                const tid = interaction.customId.split('_')[1];
                const data = client.tickets.get(tid);
                if (!data) return interaction.reply({ content: 'Ticket not found!', flags: MessageFlags.Ephemeral });
                const input = interaction.fields.getTextInputValue('userid');
                let member = null;
                if (/^\d{17,19}$/.test(input)) member = await guild.members.fetch(input).catch(() => null);
                if (!member && input.startsWith('<@')) member = await guild.members.fetch(input.replace(/[<@!>]/g, '')).catch(() => null);
                if (!member) member = guild.members.cache.find(m => m.user.username.toLowerCase() === input.toLowerCase() || m.user.tag.toLowerCase() === input.toLowerCase());
                if (!member) return interaction.reply({ content: 'User not found!', flags: MessageFlags.Ephemeral });
                const ch = guild.channels.cache.get(data.channelId);
                if (!ch) return interaction.reply({ content: 'Channel not found!', flags: MessageFlags.Ephemeral });
                await ch.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                if (!data.addedUsers) data.addedUsers = [];
                data.addedUsers.push(member.id); client.tickets.set(tid, data);
                await ch.send(`Added <@${member.id}> to ticket.`);
                client.ticketActivity.set(ch.id, Date.now());
                await interaction.reply({ content: `Added ${member.user.tag}`, flags: MessageFlags.Ephemeral });
            }
            else if (interaction.customId === 'idx_modal') {
                const cat = settings.indexCategory;
                if (!cat) return interaction.reply({ content: 'Set category with /indexcategory first!', flags: MessageFlags.Ephemeral });
                const what = interaction.fields.getTextInputValue('what');
                const pay = interaction.fields.getTextInputValue('pay');
                const first = interaction.fields.getTextInputValue('first');
                const num = (client.tickets.size + 1).toString().padStart(4, '0');
                const id = `idx-${num}`;
                const ch = await guild.channels.create({ name: `index-${id}`, type: ChannelType.GuildText, parent: cat, permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: MIDDLEMAN_ROLE, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                ]});
                const embed = createTicketEmbed(`Index Ticket ${id}`, [
                    { name: ':bust_in_silhouette: Creator', value: `<@${interaction.user.id}>`, inline: true },
                    { name: ':bar_chart: Type', value: 'Index Service', inline: true },
                    { name: ':mag: Indexing', value: what },
                    { name: ':moneybag: Payment', value: pay },
                    { name: ':white_check_mark: Go First', value: first, inline: true }
                ]);
                const msg = await ch.send({ content: `<@&${MIDDLEMAN_ROLE}>`, embeds: [embed], components: [createIndexBtns(id, false)] });
                client.tickets.set(id, { channelId: ch.id, messageId: msg.id, creatorId: interaction.user.id, type: 'index', claimed: false, claimedBy: null, addedUsers: [] });
                client.ticketActivity.set(ch.id, Date.now());
                await interaction.reply({ content: `Index ticket created! <#${ch.id}>`, flags: MessageFlags.Ephemeral });
            }
            else if (interaction.customId === 'skin_modal') {
                const cat = settings.indexCategory;
                if (!cat) return interaction.reply({ content: 'Set category with /indexcategory first!', flags: MessageFlags.Ephemeral });
                const which = interaction.fields.getTextInputValue('which');
                const payment = interaction.fields.getTextInputValue('payment');
                const agree = interaction.fields.getTextInputValue('agree');
                const num = (client.tickets.size + 1).toString().padStart(4, '0');
                const id = `bs-${num}`;
                const ch = await guild.channels.create({ name: `base-${id}`, type: ChannelType.GuildText, parent: cat, permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: MIDDLEMAN_ROLE, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                ]});
                const embed = createTicketEmbed(`Base Skin Ticket ${id}`, [
                    { name: ':bust_in_silhouette: Creator', value: `<@${interaction.user.id}>`, inline: true },
                    { name: ':art: Type', value: 'Base Skin', inline: true },
                    { name: ':mag: Looking For', value: which },
                    { name: ':moneybag: Payment', value: payment },
                    { name: ':white_check_mark: Go First', value: agree, inline: true }
                ]);
                const msg = await ch.send({ content: `<@&${MIDDLEMAN_ROLE}>`, embeds: [embed], components: [createIndexBtns(id, false)] });
                client.tickets.set(id, { channelId: ch.id, messageId: msg.id, creatorId: interaction.user.id, type: 'skin', claimed: false, claimedBy: null, addedUsers: [] });
                client.ticketActivity.set(ch.id, Date.now());
                await interaction.reply({ content: `Base skin ticket created! <#${ch.id}>`, flags: MessageFlags.Ephemeral });
            }
        }
    } catch (e) {
        console.error(e);
        const reply = { content: 'Error!', flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
        else await interaction.reply(reply);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // Update ticket activity if message is in a ticket channel
    if (client.ticketActivity.has(message.channel.id)) {
        client.ticketActivity.set(message.channel.id, Date.now());
    }

    // Check for AFK mentions
    const mentionedUsers = message.mentions.users;
    for (const [userId, user] of mentionedUsers) {
        if (client.afkUsers.has(userId)) {
            const afkData = client.afkUsers.get(userId);
            await message.reply(`<@${message.author.id}> Please dont ping again current person you pinged is afk Reason: ${afkData.reason}`);
        }
    }

    // Check if AFK user sent a message - remove AFK
    if (client.afkUsers.has(message.author.id)) {
        const afkData = client.afkUsers.get(message.author.id);
        const member = message.member;
        try {
            await member.setNickname(afkData.originalNickname);
        } catch (e) {}
        client.afkUsers.delete(message.author.id);
        await message.reply(`Welcome back <@${message.author.id}>! Your AFK has been removed.`);
    }

    // Prefix commands
    if (!message.content.startsWith('.')) return;
    const args = message.content.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    if (cmd === 'unclaim') {
        if (!isMiddleman(message.member)) return message.reply('Only middlemen!');
        let data = null, tid = null;
        for (const [id, d] of client.tickets) { if (d.channelId === message.channel.id) { data = d; tid = id; break; } }
        if (!data) return message.reply('Not a ticket channel!');
        if (!data.claimed) return message.reply('Not claimed!');
        if (data.claimedBy !== message.author.id) return message.reply('Only claimed MM!');
        data.claimed = false; data.claimedBy = null; client.tickets.set(tid, data);
        await message.channel.permissionOverwrites.delete(message.author.id);
        try {
            const msg = await message.channel.messages.fetch(data.messageId);
            const fields = msg.embeds[0].fields.filter(f => f.name !== 'Claimed By');
            const emb = createTicketEmbed(`Ticket ${tid}`, fields);
            const btns = data.type === 'mm' ? createMMBtns(tid, false) : createIndexBtns(tid, false);
            await msg.edit({ embeds: [emb], components: [btns] });
        } catch (e) {}
        await message.reply(`Unclaimed by <@${message.author.id}>`);
    }
    else if (cmd === 'close') {
        if (!isMiddleman(message.member)) return message.reply('Only middlemen!');
        let data = null, tid = null;
        for (const [id, d] of client.tickets) { if (d.channelId === message.channel.id) { data = d; tid = id; break; } }
        if (!data) return message.reply('Not a ticket channel!');
        const ch = message.guild.channels.cache.get(data.channelId);
        if (ch) await ch.delete('Closed');
        client.tickets.delete(tid);
        client.ticketActivity.delete(data.channelId);
        await message.reply('Ticket closed.');
    }
});

process.on('unhandledRejection', console.error);
client.login(process.env.TOKEN);
