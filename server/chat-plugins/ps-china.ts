import {Utils} from '../../lib';

export const commands: Chat.ChatCommands = {
	async score (target, room, user) {
		let targetUser = target.trim() || user.id;  // 等积分转移完成后改用toID()
		let ladder = await Ladders("gen8ps").getLadder();
		for (let [i, entry] of ladder.entries()) {
			if (entry[2] === targetUser || toID(entry[2]) == targetUser) {
				return this.sendReply(`${targetUser}的PS国服积分是：${entry[1]}`);
			}
		}
		return this.errorReply(`未找到用户${targetUser}的PS国服积分记录`);
	},

	bp33 (target, room, user, connection, cmd, message) {
		this.checkBroadcast();
		if (target.replace(/gen[1-8]/i, "") == "") {
			let toParse = message[0] + "randpoke 11";
			if (target.length > 0) {
				let gen = parseInt(target[3]);
				if (gen < 8) {
					for (let i = 8; i > gen; i--) {
						toParse += ", !gen" + i;
					}
					toParse += ", natdex";
				}
			}
			return this.parse(toParse);
		} else {
			return this.parse("/bp33help");
		}
	},
	bp33help: [
		`/bp33 gen[1-8] - 指定一个世代随机生成bp33精灵池`,
	],

	randset: 'randomset',
	randomset(target, room, user) {
		const [pokemonString, formatString] = target.split(',');
		this.runBroadcast();

		const format = Dex.formats.get(formatString || 'gen8freeforall');
		if (!format.exists) throw new Chat.ErrorMessage(`${formatString} is not a valid format.`);

		const species = Dex.species.get(pokemonString);
		if (!species.exists) {
			throw new Chat.ErrorMessage(`${pokemonString} is not a valid Pokémon for that format.`);
		}
		
		const set = Teams.getGenerator(format.id).randomSet(species.id);
		const prettyifiedSet = Utils.escapeHTML(Teams.export([set])).replace(/<br \/>$/, '');
		this.sendReplyBox(`<details><summary><strong>Random set for ${species.name} in ${format.name}</strong></summary>${prettyifiedSet}</details>`);
	},
	randomsethelp: [
		`/randomset [pokemon], [optional format] - Generates a random set for the given Pokémon in the specified format (or [Gen 8] Random Battle if none is specified).`,
	],
};