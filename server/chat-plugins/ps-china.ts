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
};