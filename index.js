const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
require('dotenv').config();
const fs = require('fs');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

client.tickets = new Map();
client.settings = new Map();

const SETTINGS_FILE = './settings.json';

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

function saveSettings() {
    const obj = {};
    for (const [guildId, settings] of client.settings) {
        obj[guildId] = settings;
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(obj, null, 2));
}

const IMAGE_URL = 'https://i.ibb.co/gLFB3BGn/d7army.png';
const ADMIN_ROLE = process.env.ADMIN_ROLE_ID || '1463189207282356276';
const MIDDLEMAN_ROLE = process.env.MIDDLEMAN_ROLE_ID || '1494798337361186998';

function isAdmin(member) { 
    return member.roles.cache.has(ADMIN_ROLE) || member.permissions.has('Administrator'); 
}

function isMiddleman(member) { 
    return member.roles.cache.has(MIDDLEMAN_ROLE); 
}

function createPanelEmbed(title, desc) {
    return new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle(title)
        .setDescription(desc)
        .setImage(IMAGE_URL)
        .setFooter({ text: 'D7 Army Service', iconURL: IMAGE_URL });
}

function createTicketEmbed(title, fields) {
    return new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle(title)
        .addFields(fields)
        .setFooter({ text: 'D7 Army Service' });
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
    new SlashCommandBuilder().setName('indexpanel').setDescription('Spawn index ticket panel').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).toJSON(),
    new SlashCommandBuilder().setName('ticketcategory').setDescription('Set MM ticket category').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addStringOption(o => o.setName('id').setDescription('Category ID').setRequired(true)).toJSON(),
    new SlashCommandBuilder().setName('indexcategory').setDescription('Set index ticket category').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addStringOption(o => o.setName('id').setDescription('Category ID').setRequired(true)).toJSON(),
    new SlashCommandBuilder().setName('say').setDescription('Send message as bot').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true).addChannelTypes(ChannelType.GuildText)).addStringOption(o => o.setName('message').setDescription('Message').setRequired(true)).addStringOption(o => o.setName('ping').setDescription('Optional ping').setRequired(false).addChoices({name:'@everyone',value:'everyone'},{name:'@here',value:'here'})).addStringOption(o => o.setName('embed').setDescription('Send as embed? (y/n)').setRequired(false)).toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('D7 Army Service', { type: 3 });
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
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;
            if (commandName === 'ticketpanel') {
                const embed = createPanelEmbed('__D7 ARMY MM__', 'Welcome to D7Army Middleman Service.\nPlease wait patiently for support and try not to ping. Our service is trusted by thousands and we hope we could expand our services so we could encourage other people to start middleman services like us!\n\n- Allowed Ping 1 time\n- Wait patiently\n- Be respectful to staff/middlemen\n\nAny type of fraud will be taken to extreme level which will cause an instant ban with blacklist from Kooda\'s, Liam\'s, Jace\'s Etc!\n\nThanks for reading this.');
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('spawn_mm').setLabel('Create Ticket').setStyle(ButtonStyle.Success).setEmoji('ð«'));
                await interaction.reply({ embeds: [embed], components: [row] });
            }
            else if (commandName === 'indexpanel') {
                const embed = createPanelEmbed('Indexing Service D7 Army!', 'Welcome to our indexing service, we provide indexes and base skins. To purchase an index or a base skin, create a ticket and wait patiently for an answer.\n\n- Always you go first\n- Listen to the middleman\n- Any type of fraud is instant ban\n\nThanks for using our service!');
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('spawn_idx').setLabel('Create Index Ticket').setStyle(ButtonStyle.Success).setEmoji('ð'));
                await interaction.reply({ embeds: [embed], components: [row] });
            }
            else if (commandName === 'ticketcategory') {
                const id = interaction.options.getString('id');
                const cat = interaction.guild.channels.cache.get(id);
                if (!cat || cat.type !== 4) return interaction.reply({ content: 'Invalid category ID!', ephemeral: true });
                if (!client.settings.has(interaction.guild.id)) client.settings.set(interaction.guild.id, {});
                client.settings.get(interaction.guild.id).ticketCategory = id;
                saveSettings();
                await interaction.reply({ content: `MM category set to **${cat.name}**`, ephemeral: true });
            }
            else if (commandName === 'indexcategory') {
                const id = interaction.options.getString('id');
                const cat = interaction.guild.channels.cache.get(id);
                if (!cat || cat.type !== 4) return interaction.reply({ content: 'Invalid category ID!', ephemeral: true });
                if (!client.settings.has(interaction.guild.id)) client.settings.set(interaction.guild.id, {});
                client.settings.get(interaction.guild.id).indexCategory = id;
                saveSettings();
                await interaction.reply({ content: `Index category set to **${cat.name}**`, ephemeral: true });
            }
            else if (commandName === 'say') {
                const ch = interaction.options.getChannel('channel');
                let msg = interaction.options.getString('message');
                const ping = interaction.options.getString('ping');
                const embedOpt = interaction.options.getString('embed');
                if (ping === 'everyone') msg = '@everyone ' + msg;
                else if (ping === 'here') msg = '@here ' + msg;
                if (embedOpt && embedOpt.toLowerCase() === 'y') {
                    const embed = new EmbedBuilder().setColor(0xFF0000).setDescription(msg).setFooter({ text: 'D7 Army Service' });
                    await ch.send({ embeds: [embed] });
                } else {
                    await ch.send(msg);
                }
                await interaction.reply({ content: `Sent to ${ch}`, ephemeral: true });
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
                    new StringSelectMenuOptionBuilder().setLabel('Index Service').setDescription('Purchase an index').setValue('index').setEmoji('ð'),
                    new StringSelectMenuOptionBuilder().setLabel('Base Skin').setDescription('Purchase a base skin').setValue('skin').setEmoji('ð¨')
                );
                await interaction.reply({ content: 'Select service type:', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
            }
            else if (action === 'claim') {
                const data = client.tickets.get(ticketId);
                if (!data) return interaction.reply({ content: 'Ticket not found!', ephemeral: true });
                if (!isMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', ephemeral: true });
                if (data.claimed) return interaction.reply({ content: 'Already claimed!', ephemeral: true });
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
                if (!data) return interaction.reply({ content: 'Ticket not found!', ephemeral: true });
                if (!isMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', ephemeral: true });
                if (!data.claimed) return interaction.reply({ content: 'Not claimed!', ephemeral: true });
                if (data.claimedBy !== interaction.user.id) return interaction.reply({ content: 'Only claimed MM!', ephemeral: true });
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
                if (!data) return interaction.reply({ content: 'Ticket not found!', ephemeral: true });
                if (!isMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', ephemeral: true });
                const ch = interaction.guild.channels.cache.get(data.channelId);
                if (ch) await ch.delete('Closed');
                client.tickets.delete(ticketId);
                await interaction.reply({ content: 'Ticket closed.' });
            }
            else if (action === 'adduser') {
                const data = client.tickets.get(ticketId);
                if (!data) return interaction.reply({ content: 'Ticket not found!', ephemeral: true });
                if (!isMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', ephemeral: true });
                const modal = new ModalBuilder().setCustomId(`adduser_${ticketId}`).setTitle('Add User to Ticket');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('userid').setLabel('Username or ID').setStyle(TextInputStyle.Short).setRequired(true)));
                await interaction.showModal(modal);
            }
            else if (action === 'idxclaim') {
                const data = client.tickets.get(ticketId);
                if (!data) return interaction.reply({ content: 'Ticket not found!', ephemeral: true });
                if (!isMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', ephemeral: true });
                if (data.claimed) return interaction.reply({ content: 'Already claimed!', ephemeral: true });
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
                if (!data) return interaction.reply({ content: 'Ticket not found!', ephemeral: true });
                if (!isMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', ephemeral: true });
                if (!data.claimed) return interaction.reply({ content: 'Not claimed!', ephemeral: true });
                if (data.claimedBy !== interaction.user.id) return interaction.reply({ content: 'Only claimed MM!', ephemeral: true });
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
                if (!data) return interaction.reply({ content: 'Ticket not found!', ephemeral: true });
                if (!isMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', ephemeral: true });
                const ch = interaction.guild.channels.cache.get(data.channelId);
                if (ch) await ch.delete('Closed');
                client.tickets.delete(ticketId);
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
                if (!cat) return interaction.reply({ content: 'Set category with /ticketcategory first!', ephemeral: true });
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
                    { name: 'ð¤ Creator', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'ð Other Trader', value: '\`\`\`' + trader + '\`\`\`', inline: true },
                    { name: 'ð Description', value: desc },
                    { name: 'â Rules', value: rules, inline: true }
                ]);
                const msg = await ch.send({ content: `<@&${MIDDLEMAN_ROLE}>`, embeds: [embed], components: [createMMBtns(id, false)] });
                client.tickets.set(id, { channelId: ch.id, messageId: msg.id, creatorId: interaction.user.id, type: 'mm', claimed: false, claimedBy: null, addedUsers: [] });
                await interaction.reply({ content: `Ticket created! <#${ch.id}>`, ephemeral: true });
            }
            else if (interaction.customId.startsWith('adduser_')) {
                const tid = interaction.customId.split('_')[1];
                const data = client.tickets.get(tid);
                if (!data) return interaction.reply({ content: 'Ticket not found!', ephemeral: true });
                const input = interaction.fields.getTextInputValue('userid');
                let member = null;
                if (/^\d{17,19}$/.test(input)) member = await guild.members.fetch(input).catch(() => null);
                if (!member && input.startsWith('<@')) member = await guild.members.fetch(input.replace(/[<@!>]/g, '')).catch(() => null);
                if (!member) member = guild.members.cache.find(m => m.user.username.toLowerCase() === input.toLowerCase() || m.user.tag.toLowerCase() === input.toLowerCase());
                if (!member) return interaction.reply({ content: 'User not found!', ephemeral: true });
                const ch = guild.channels.cache.get(data.channelId);
                if (!ch) return interaction.reply({ content: 'Channel not found!', ephemeral: true });
                await ch.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                if (!data.addedUsers) data.addedUsers = [];
                data.addedUsers.push(member.id); client.tickets.set(tid, data);
                await ch.send(`Added <@${member.id}> to ticket.`);
                await interaction.reply({ content: `Added ${member.user.tag}`, ephemeral: true });
            }
            else if (interaction.customId === 'idx_modal') {
                const cat = settings.indexCategory;
                if (!cat) return interaction.reply({ content: 'Set category with /indexcategory first!', ephemeral: true });
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
                    { name: 'ð¤ Creator', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'ð Type', value: 'Index Service', inline: true },
                    { name: 'ð Indexing', value: what },
                    { name: 'ð° Payment', value: pay },
                    { name: 'â Go First', value: first, inline: true }
                ]);
                const msg = await ch.send({ content: `<@&${MIDDLEMAN_ROLE}>`, embeds: [embed], components: [createIndexBtns(id, false)] });
                client.tickets.set(id, { channelId: ch.id, messageId: msg.id, creatorId: interaction.user.id, type: 'index', claimed: false, claimedBy: null, addedUsers: [] });
                await interaction.reply({ content: `Index ticket created! <#${ch.id}>`, ephemeral: true });
            }
            else if (interaction.customId === 'skin_modal') {
                const cat = settings.indexCategory;
                if (!cat) return interaction.reply({ content: 'Set category with /indexcategory first!', ephemeral: true });
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
                    { name: 'ð¤ Creator', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'ð¨ Type', value: 'Base Skin', inline: true },
                    { name: 'ð Looking For', value: which },
                    { name: 'ð° Payment', value: payment },
                    { name: 'â Go First', value: agree, inline: true }
                ]);
                const msg = await ch.send({ content: `<@&${MIDDLEMAN_ROLE}>`, embeds: [embed], components: [createIndexBtns(id, false)] });
                client.tickets.set(id, { channelId: ch.id, messageId: msg.id, creatorId: interaction.user.id, type: 'skin', claimed: false, claimedBy: null, addedUsers: [] });
                await interaction.reply({ content: `Base skin ticket created! <#${ch.id}>`, ephemeral: true });
            }
        }
    } catch (e) {
        console.error(e);
        const reply = { content: 'Error!', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
        else await interaction.reply(reply);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild || !message.content.startsWith('.')) return;
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
        await message.reply('Ticket closed.');
    }
});

process.on('unhandledRejection', console.error);
client.login(process.env.TOKEN);
