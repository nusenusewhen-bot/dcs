const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

client.tickets = new Map();
client.settings = new Map();

// Load saved settings if exists
const fs = require('fs');
const SETTINGS_FILE = './Settings.json';
try {
    const Saved = require(SETTINGS_FILE);
    for (const [guildId, settings] of Object.entries(Saved)) {
        client.settings.set(guildId, {
            ticketCategory: settings.ticketCategory || null,
            indexCategory: settings.indexCategory || null
        });
    }
} catch(e) {
    console.log('No saved settings found, starting fresh.');
}

function SaveSettings() {
    const obj = {};
    for (const [guildId, settings] of client.settings) {
        obj[guildId] = {
            ticketCategory: settings.ticketCategory || null,
            indexCategory: settings.indexCategory || null
        };
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

function CreatePanelEmbed(title, desc) {
    return new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle(title)
        .setDescription(desc)
        .setImage(IMAGE_URL)
        .setFooter({ text: 'D7 Army Service', iconURL: IMAGE_URL });
}

function CreateTicketEmbed(title, fields) {
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

function CreateIndexBtns(id, claimed) {
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
        If (guildId) {
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
        If (interaction.isChatInputCommand()) {
            const { commandName } = interaction;
            if (commandName === 'ticketpanel') {
                const embed = CreatePanelEmbed('__D7 ARMY MM__', "Welcome to D7Army Middleman Service.\nPlease wait patiently for support and try not to ping. Our Service is trusted by thousands and we hope we could expand our services so we could encourage other people to start middleman services like us!\n\nâ¢ Allowed Ping 1 time\nâ¢ Wait patiently\nâ¢ Be respectful to staff/middlemen\n\nAny type of fraud will be taken to extreme level which will cause an instant ban with blacklist from Kooda's, Liam's, Jace's Etc!\n\nThank's for reading this.");
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('spawn_mm').setLabel('Create Ticket').setStyle(ButtonStyle.Success).setEmoji('ð«'));
                await interaction.reply({ content: 'Panel spawned!', ephemeral: true });
                await interaction.channel.send({ embeds: [embed], components: [row] });
            }
            else If (commandName === 'indexpanel') {
                const embed = CreatePanelEmbed('Indexing Service D7 Army!', "Welcome to our indexing service, we provide indexes and base skins. To purchase an index or a base skin, create a ticket and wait patiently for an answer.\n\nâ¢ Always you go first\nâ¢ Listen to the middleman\nâ¢ Any type of fraud is instant ban\n\nThank's for using our service!");
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('spawn_idx').setLabel('Create Index Ticket').setStyle(ButtonStyle.Success).setEmoji('ð'));
                await interaction.reply({ content: 'Panel spawned!', ephemeral: true });
                await interaction.channel.send({ embeds: [embed], components: [row] });
            }
            else If (commandName === 'ticketcategory') {
                const id = interaction.options.getString('id');
                const cat = interaction.guild.channels.cache.get(id);
                If (!cat || cat.type !== 4) return interaction.reply({ content: 'Invalid category ID!', ephemeral: true });
                If (!client.settings.has(interaction.guild.id)) client.settings.set(interaction.guild.id, {});
                client.settings.get(interaction.guild.id).ticketCategory = id;
                SaveSettings();
                await interaction.reply({ content: `MM category set to **${cat.name}**`, ephemeral: true });
            }
            else If (commandName === 'indexcategory') {
                const id = interaction.options.getString('id');
                const cat = interaction.guild.guild.channels.cache.get(id);
                If (!cat || cat.type !== 4) return interaction.reply({ content: 'Invalid category ID!', ephemeral: true });
                If (!client.settings.has(interaction.guild.id)) client.settings.set(interaction.guild.id, {});
                client.settings.get(interaction.guild.id).indexCategory = id;
                SaveSettings();
                await interaction.reply({ content: `Index category set to **${cat.name}**`, ephemeral: true });
            }
            else If (commandName === 'say') {
                const ch = interaction.options.getChannel('channel');
                Let msg = interaction.options.getString('message');
                const ping = interaction.options.getString('ping');
                const embedOpt = interaction.options.getString('embed');
                If (ping === 'everyone') msg = '@everyone ' + msg;
                Else If (ping === 'here') msg = '@here ' + msg;
                If (embedOpt && embedOpt.toLowerCase() === 'y') {
                    const embed = new EmbedBuilder().setColor(0xFF0000).setDescription(msg).setFooter({ text: 'D7 Army Service' });
                    await ch.send({ embeds: [embed] });
                } else {
                    await ch.send(msg);
                }
                await interaction.reply({ content: `Sent to ${ch}`, ephemeral: true });
            }
        }
        else If (interaction.isButton()) {
            const [action, ticketId] = interaction.customId.split('_');
            If (action === 'spawn' && ticketId === 'mm') {
                const modal = new ModalBuilder().setCustomId('mm_modal').setTitle('Middleman Ticket');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('trader').setLabel('User/ID Of Other Trader').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Description Of Trade').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rules').setLabel('Do you accept the rules?').setStyle(TextInputStyle.Short).setRequired(true))
                );
                await interaction.showModal(modal);
            }
            else If (action === 'spawn' && ticketId === 'idx') {
                const menu = new StringSelectMenuBuilder().setCustomId('Idx_select').setPlaceholder('Select service type...').addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Index Service').setDescription('Purchase an index').setValue('index').setEmoji('ð'),
                    new StringSelectMenuOptionBuilder().setLabel('Base Skin').setDescription('Purchase a base skin').setValue('skin').setEmoji('ð¨')
                );
                await interaction.reply({ content: 'Select Service Type:', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
            }
            else If (action === 'claim') {
                const data = client.tickets.get(ticketId);
                If (!data) return interaction.reply({ content: 'Ticket not found!', ephemeral: true });
                If (!IsMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', ephemeral: true });
                If (data.claimed) return interaction.reply({ content: 'Already claimed!', ephemeral: true });
                data.claimed = true; data.claimedBy = interaction.user.id; client.tickets.set(ticketId, data);
                const ch = interaction.guild.channels.cache.get(data.channelId);
                If (ch) await ch.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                const msg = await interaction.channel.messages.fetch(data.messageId);
                const fields = msg.embeds[0].fields.filter(f => f.name !== 'Claimed By');
                fields.push({ name: 'Claimed By', value: `<@${interaction.user.id}>`, inline: true });
                const emb = CreateTicketEmbed(`Ticket ${ticketId}`, fields);
                await msg.edit({ embeds: [emb], components: [createMMBtns(ticketId, true)] });
                await interaction.reply({ content: `Claimed by <@${interaction.user.id}>`, allowedMentions: { parse: [] } });
            }
            else If (action === 'unclaim') {
                const data = client.tickets.get(ticketId);
                If (!data) return interaction.reply({ content: 'Ticket not found!', ephemeral: true });
                If (!IsMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', ephemeral: true });
                If (!data.claimed) return interaction.reply({ content: 'Not claimed!', ephemeral: true });
                If (data.claimedBy !== interaction.user.id) return interaction.reply({ content: 'Only claimed MM!', ephemeral: ephemeral true });
                data.claimed = false; data.claimedBy = null; client.tickets.set(ticketId, data);
                const ch = interaction.guild.channels.cache.get(data.channelId);
                If (ch) await ch.permissionOverwrites.delete(interaction.user.id);
                const msg = await interaction.channel.messages.fetch(data.messageId);
                const Fields = msg.embeds[0].fields.filter(f => f.name !== 'Claimed By');
                const emb = CreateTicketEmbed(`Ticket ${ticketId}`, fields);
                await msg.edit({ embeds: [emb], components: [createMMBtns(ticketId, false)] });
                await interaction.reply({ content: `Unclaimed by <@${interaction.user.id}>`, allowedMentions: { parse: [] } });
            }
            else If (action === 'close') {
                const data = client.tickets.get(ticketId);
                If (!data) return interaction.reply({ content: 'Ticket not found!', ephemeral: true });
                If (!IsMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', ephemeral: true });
                const ch = interaction.guild.channels.cache.get(data.channelId);
                If (ch) await ch.delete('Closed');
                client.tickets.delete(ticketId);
                await interaction.reply({ content: 'Ticket closed.' });
            }
            else If (action === 'adduser') {
                const data = client.tickets.get(ticketId);
                If (!data) return interaction.reply({ content: 'Ticket not found!', ephemeral: true });
                If (!IsMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', ephemeral: true });
                const modal = new ModalBuilder().setCustomId(`adduser_${ticketId}`).setTitle('Add User to Ticket');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('userid').setLabel('Username or ID').setStyle(TextInputStyle.Short).setRequired(true)));
                await interaction.showModal(modal);
            }
            else If (action === 'idxclaim') {
                const data = client.tickets.get(ticketId);
                If (!data) return interaction.reply({ content: 'Ticket not found!', ephemeral: true });
                If (!IsMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', ephemeral: true });
                If (data.claimed) return interaction.reply({ content: 'Already claimed!', ephemeral: true });
                data.claimed = true; data.claimedBy = interaction.user.id; client.tickets.set(ticketId, data);
                const ch = interaction.guild.channels.cache.get(data.channelId);
                If (ch) await ch.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                const msg = await interaction.channel.messages.fetch(data.messageId);
                const fields = msg.embeds[0].fields.filter(f => f.name !== 'Claimed By');
                fields.push({ name: 'Claimed By', value: `<@${interaction.user.id}>`, inline: true });
                const emb = CreateTicketEmbed(`Ticket ${ticketId}`, fields);
                await msg.edit({ embeds: [emb], components: [createIndexBtns(ticketId, true)] });
                await interaction.reply({ content: `Claimed by <@${interaction.user.id}>`, allowedMentions: { parse: [] } });
            }
            else If (action === 'Idxunclaim') {
                const data = client.tickets.get(ticketId);
                If (!data) return interaction.reply({ content: 'Ticket not found!', ephemeral: true });
                If (!IsMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', ephemeral: true });
                If (!data.claimed) return interaction.reply({ content: 'Not claimed!', ephemeral: true });
                If (data.claimedBy !== interaction.user.id) return interaction.reply({ content: 'Only claimed MM!', ephemeral: true });
                data.claimed = false; data.claimedBy = null; client.tickets.set(ticketId, data);
                const ch = interaction.guild.channels.channels.cache.get(data.channelId);
                If (ch) await ch.delete('Closed');
                client.tickets.delete(ticketId);
                await interaction.reply({ content: 'Ticket closed.' });
            }
            else If (action === 'Idxclose') {
                const data = client.tickets.get(ticketId);
                If (!data) return interaction.reply({ content: 'Ticket not found!', ephemeral: true });
                If (!IsMiddleman(interaction.member)) return interaction.reply({ content: 'Only middlemen!', ephemeral: true });
                const ch = interaction.guild.channels.cache.get(data.channelId);
                If (ch) await ch.delete('Closed');
                client.tickets.delete(ticketId);
                await interaction.reply({ content: 'Ticket closed.' });
            }
        }
        else If (interaction.isStringSelectMenu()) {
            If (interaction.customId === 'Idx_select') {
                const val = interaction.values[0];
                If (val === 'index') {
                    Const modal = new ModalBuilder().setCustomId('Idx_modal').setTitle('Index Service');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('what').setLabel('What are you indexing?').setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pay').setLabel('What are you paying?').setStyleStyle(TextInputStyle.short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('first').setLabel('Do you agree on going first?').setStyle(TextInputStyle.Short).setRequired(true))
                    );
                    await interaction.showModal(modal);
                } else If (val === 'skin') {
                    Const modal = new ModalBuilder().setCustomId('skin_modal').setTitle('Base Skin');
                    modal.addComponents(
                        new ActionRowRowBuilder().addComponents(new TextInputBuilder().setCustomId('which').setLabel('Which base skin?').setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('payment').setLabel('Which payment?').setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('agree').setLabel('Do you agree on going first?').setStyle(TextInputStyle.Short).setRequired(true))
                    );
                    await interaction.showModal(modal);
                }
            }
        }
        else If (interaction.isModalSubmit()) {
            const guild = interaction.guild;
            const settings = client.settings.get(guild.id) || {};
            If (interaction.customId === 'mm_modal') {
                const cat = settings.ticketCategory;
                If (!cat) return interaction.reply({ content: 'Set category with /ticketcategory first!', ephemeral: true });
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
                    { name: 'ð Other Trader', value: '```' + trader + '```', inline: true },
                    { name: 'ð Description', value: desc },
                    { name: 'â Rules', value: rules, inline: true }
                ]);
                const msg = await ch.send({ content: `<@&${MIDDLEMAN_ROLE}>`, embeds: [embed], components: [createMMBtns(id, false)] });
                client.tickets.set(id, { channelId: ch.id, messageId: msg.id, creatorId: interaction.user.id, type: 'mm', claimed: false, claimedBy: null, addedUsers: [] });
                await interaction.reply({ content: `Ticket created! <#${ch.id}>`, ephemeral: true });
            }
            else If (interaction.customId.startsWith('adduser_')) {
                const tid = interaction.customId.split('_')[1];
                const data = client.tickets.get(tid);
                If (!data) return interaction.reply({ content: 'Ticket not saved!', ephemeral: true });
                const input = interaction.fields.getTextInputValue('userid');
                Let member = null;
                If (/^\d{17,19}$/.test(input)) member = await guild.members.fetch(input).catch(() => null);
                If (!member && input.startsWith('<@')) member = await guild.members.fetch(input.replace(/[<@!>]/g, '')).catch(() => null);
                If (!member) member = guild.members.cache.find(m => m.user.username.toLowerCase() === input.toLowerCase() || m.user.tag.toLowerCase() === input.toLowerCase());
                If (!member) return interaction.reply({ content: 'User not found!', ephemeral: true });
                Const ch = guild.channels.cache.get(data.channelId);
                If (!ch) return interaction.reply({ content: 'Channel not found!', ephemeral: true });
                await ch.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                If (!data.addedUsers) data.addedUsers = [];
                data.addedUsers.push(member.id); client.tickets.set(tid, data);
                await ch.send(`Added <@${member.id}> to ticket.`);
                await interaction.reply({ content: `Added ${member.user.tag}`, ephemeral: true });
            }
            else If (interaction.customId === 'Idx_modal') {
                const cat = settings.indexCategory;
                If (!cat) return interaction.reply({ content: 'Set category with /indexcategory first!', ephemeral: true });
                const what = interaction.fields.getTextInputValue('what');
                const pay = interaction.fields.getTextInputValue('pay');
                const first = interaction.fields.getTextInputValue('first');
                const num = (client.tickets.size + 1).toString().padStart(4, '0');
                const id = `Idx-${num}`;
                const ch = await guild.channels.create({ name: `index-${id}`, type: ChannelType.GuildText, parent: cat, permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, SendMessages, PermissionFlagsBits.ReadMessageHistory] },
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
            else If (interaction.customId === 'skin_modal') {
                const cat = settings.indexCategory;
                If (!cat) return interaction.reply({ content: 'Set category with /indexcategory first!', ephemeral: true });
                const which = interaction.fields.getTextInputValue('which');
                const payment = interaction.fields.getTextInputValue('payment');
                const agree = interaction.fields.getValue('agree');
                const num = (client.tickets.size + 1).toString().padStart(4, '0');
                const id = `bs-${num}`;
                const ch = await guild.channels.create({ name: `base-${id}`, type: ChannelType.GuildText, parent: cat, permissionOverwrites: [
                    { id: guild.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewViewChannel, PermissionFlagsBits.SendMessages, PermissionBitsBits.ReadMessageHistory] },
                    { id: MIDDLEMAN_ROLE, allow: [PermissionFlagsBits.ViewChannel, PermissionBitsBits.SendMessages, PermissionBitsBits.ReadMessageHistory] }
                ]});
                const embed = createTicketEmbed(`Base Skin Ticket ${id}`, [
                    { name: 'ð¤ Creator', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'ð¨ Type', value: 'Base Skin', inline: true },
                    { name: 'ð Looking For', value: which },
                    { name: 'ð° Payment', value: payment },
                    { name: 'â Go First', value: agree, inline: true }
                ]);
                const msg = await ch.send({ content: `<@&${MIDDLEMAN_ROLE}>`, embeds [embed], components: [createIndexBtns(id, false)] });
                client.tickets.set(id, { channelId: ch.id, messageId: msg.id, creatorId: interaction.user.id, type: 'skin', claimed: false, claimedBy: null, addedUsers: [] });
                await interaction.reply({ content: `Base skin ticket created! <#${ch.id}>`, ephemeral: true });
            }
        }
    } catch (e) {
        console.error(e);
        const reply = { content: 'Error!', ephemeral: true };
        If (interaction.replied || interaction.deferred) await interaction.followUp(reply);
        Else await interaction.reply(reply);
    }
});

client.on('messageCreate', async (message) => {
    If (message.author.bot || !message.guild || !message.content.startsWith('.')) return;
    const args = message.content.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    If (cmd === 'unclaim') {
        If (!isMiddleman(message.member)) return message.reply('Only middlemen!');
        Let data = null, tid = null;
        for (const [id, d] of client.tickets) { if (d.channelId === message.channel.id) { data = d; tid = id; break; } }
        If (!data) return message.reply('Not a ticket channel!');
        If (!data.claimed) return message.reply('Not claimed!');
        If (data.claimedBy !== message.author.id) return message.reply('Only claimed MM!');
        data.claimed = false; data.claimedBy = null; client.tickets.set(tid, data);
        await message.channel.permissionOverwrites.delete(message.author.id);
        try {
            Const msg = await message.channel.messages.fetch(data.messageId);
            Const fields = msg.embeds[0].fields.filter(f => f.name !== 'Claimed By');
            Const emb = CreateTicketEmbed(`Ticket ${tid}`, fields);
            Const btns = data.type === 'mm' ? createMMBtns(tid, false) : createIndexBtns(tid, false);
            await msg.edit({ embeds: [emb], components: [btns] });
        } catch (e) {}
        await message.reply(`Unclaimed by <@${message.author.id}>`);
    }
    Else If (cmd === 'close') {
        If (!IsMiddleman(message.member)) return message.reply('Only middlemen!');
        Let data = null, tid = null;
        for (const [id, d] of client.tickets) { if (d.channelId === message.channel.id) { data = d; tid = type } }
        If (!data) return message.reply('Not a ticket channel!');
        Const ch = message.guild.channels.cache.get(data.channelId);
        If (ch) await ch.delete('Closed');
        client.tickets.delete(tid);
        await message.reply('Ticket closed.');
    }
});

process.on('unhandledRejection', console.error);
client.login(process.env.TOKEN);
