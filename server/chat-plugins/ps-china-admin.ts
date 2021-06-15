import {FS} from '../../lib';

export const commands: Chat.ChatCommands = {
	async pschinascore(target, room, user) {
		this.checkCan('lock');
		if (!room || !room.settings.staffRoom) {
			this.errorReply("在staff room更新ps国服积分");
			return false;
		}

		let userid = target.split(',')[0]?.trim();  // 等积分转移完成后改用toID()
		let score = target.split(',')[1]?.trim();
		let reason = target.split(',')[2]?.trim();
		if (!userid || !score || !reason || isNaN(parseInt(score))) {
			return this.parse("/pschinascorehelp");
		}

		let ladder = await Ladders("gen8ps").getLadder();
		let userIndex = ladder.length;	
		for (let [i, entry] of ladder.entries()) {
			if (entry[2] === userid) {
				userIndex = i;
				break;
			}
		}
		if (userIndex === ladder.length) ladder.push([userid, 0, userid, 0, 0, 0, '']);
		let oldScore = ladder[userIndex][1];
		let newScore = oldScore + parseInt(score);
		if (newScore < 0) {
			return this.errorReply("错误：将造成负分。");
		}
		ladder[userIndex][1] = newScore;

		let newIndex = userIndex;
		while (newIndex > 0 && ladder[newIndex - 1][1] <= newScore) newIndex--;
		while (ladder[newIndex] && ladder[newIndex][1] >= newScore) newIndex++;
		if (newIndex !== userIndex && newIndex !== userIndex + 1) {
			let row = ladder.splice(userIndex, 1)[0];
			if (newIndex > userIndex) newIndex--;
			ladder.splice(newIndex, 0, row);
		}

		let lastIndex = ladder.length - 1;
		while (ladder[lastIndex][1] <= 0) lastIndex--;
		ladder.splice(lastIndex + 1, ladder.length);

		Ladders("gen8ps").save();
		let message = `用户ID: ${userid}, PS国服积分: ` +
			`${oldScore} ${score < 0 ? "-" : "+"} ${Math.abs(score)} -> ${newScore}, ` +
			`原因:${reason}, 操作人:${user.name}.`;
		this.globalModlog(message);
		this.addModAction(message);
	},
	pschinascorehelp: [
		`/pschinascore user, score, reason - 给user用户的国服积分增加score分，说明原因. Requires: & ~`,
	],

	async restorereplay(target, room, user) {
		this.checkCan('lockdown');
		let params = target.split(',');
		if (!params || params.length != 4) {
			return this.errorReply("/restorereplay player1, player2, format, year-month-date");
		}
		let p1 = params[0].toLowerCase().replace(/[^\w\d\s]/g, '').replace(/\s+/g, '');
		let p2 = params[1].toLowerCase().replace(/[^\w\d\s]/g, '').replace(/\s+/g, '');
		let format = params[2].toLowerCase().replace(/[^\w\d\s]/g, '').replace(/\s+/g, '');
		let date = params[3].replace(/\s+/g, '');

		this.globalModlog('REPLAYRESTORE', `${p1}, ${p2}, ${format}, ${date}`, `By ${user.name}.`);
		let dir = `logs/${date.substr(0, 7)}/${format}/${date}`;

		let files = [];
		try {
			files = await FS(dir).readdir();
		} catch (err) {
			if (err.code === 'ENOENT') {
				return this.errorReply("Replay not found.");
			}
			throw err;
		}

		let foundReplay = false;
		const rep_head = await FS(`config/replay-head.txt`).readIfExists();
		const rep_tail = await FS(`config/replay-tail.txt`).readIfExists();
		for (const file of files) {
			const json = await FS(`${dir}/${file}`).readIfExists();
			const data = JSON.parse(json);
			if ((toID(data.p1) === p1 && toID(data.p2) === p2) || (toID(data.p1) === p2 && toID(data.p2) === p1)) {
				foundReplay = true;
				const htmlname = file.replace(".log.json", ".html");
				await FS(`config/avatars/static/${htmlname}`).write(rep_head + data.log.join('\n') + rep_tail);
				this.sendReply(`http://47.94.147.145:8000/avatars/static/${htmlname}`);
			}
		}
		if (!foundReplay) {
			return this.errorReply("Replay not found.");
		}
	}
};