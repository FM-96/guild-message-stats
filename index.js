require('dotenv').config();

const Discord = require('discord.js');

const fs = require('fs');

const client = new Discord.Client();

client.once('ready', async () => {
	const guild = client.guilds.get(process.env.GUILD_ID);
	const me = await guild.fetchMember(client.user);

	const messages = [];
	for (const channel of guild.channels.array().filter(e => e.type === 'text' && e.permissionsFor(me).has(Discord.Permissions.FLAGS.VIEW_CHANNEL | Discord.Permissions.FLAGS.READ_MESSAGE_HISTORY))) {
		const channelHistory = await getChannelHistory(channel);
		console.log(`${channel.name}: ${channelHistory.length} messages`);
		messages.push(...channelHistory);
	}
	console.log(`${messages.length} messages in total`);

	const dateFinished = new Date();

	const userMessagecountMap = new Map();
	for (const msg of messages) {
		const value = userMessagecountMap.get(msg.author.id) || {count: 0, first: msg.createdTimestamp};
		value.count++;
		value.first = Math.min(value.first, msg.createdTimestamp);
		userMessagecountMap.set(msg.author.id, value);
	}
	console.log('mapped messages to users');

	let csvText = 'Username,Tag,User ID,Total Message Count,Days Since First Message,Average Daily Message Count\n';
	for (const entry of Array.from(userMessagecountMap.entries()).sort((a, b) => b[1].count - a[1].count)) {
		const author = await client.fetchUser(entry[0]);
		let csvUsername, csvTag;
		if (author.username.includes(',')) {
			csvUsername = `"${author.username}"`;
			csvTag = `"${author.tag}"`;
		} else {
			csvUsername = author.username;
			csvTag = author.tag;
		}

		const daysSinceFirstMessage = (dateFinished - new Date(entry[1].first)) / (1000 * 60 * 60 * 24);

		csvText += `${csvUsername},${csvTag},${author.id},${entry[1].count},${daysSinceFirstMessage},${entry[1].count / daysSinceFirstMessage}\n`;
	}
	console.log('generated CSV file');

	fs.writeFileSync(`message-stats-${process.env.GUILD_ID}-${dateFinished.toISOString().slice(0, -5).replace(/-|:/g, '') + 'Z'}.csv`, csvText);
	console.log('saved CSV file');

	process.exit(0);
});

client.login(process.env.BOT_TOKEN);

/**
 * Fetches all messages from a channel
 * @param {*} channel The channel to fetch the messages in
 * @returns {Promise.<Array.<Object>>} An array of all fetched messages
 */
async function getChannelHistory(channel) {
	const result = [];
	let lastMessage;
	let done = false;

	do {
		const options = {limit: 100};
		options.before = lastMessage;

		const messages = await channel.fetchMessages(options);
		if (messages.size) {
			result.push(...messages.values());
			lastMessage = messages.lastKey();
		} else {
			done = true;
		}
	} while (!done);

	return result;
}
