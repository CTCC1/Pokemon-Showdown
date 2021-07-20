import { FS } from '../../lib';
import type { PartialModlogEntry } from '../modlog';
import type { TournamentPlayer } from '../tournaments';

if (!FS('logs/modlog/iplog').existsSync()) FS('logs/modlog/iplog').mkdir();

let userAlts: {[mainid: string]: {'alts': string[], 'ips': string[]}} = {};
let altToMainId: {[altid: string]: string} = {};
let ipToMainId: {[ip: string]: string} = {};

function sleep(time: number) {
	// @ts-ignore
    return new Promise(resolve => setTimeout(resolve, time));
}

function getTourFormat(): string | undefined {
	try {
		const date = new Date();
		const tourConfig: {[hour: string]: string} = JSON.parse(FS('config/tour-config.json').readIfExistsSync())[date.getDay()];
		for (let hour in tourConfig) {
			const hourDiff = (date.getTime() - (parseInt(hour) - 8) * 1000 * 60 * 60) / (1000 * 60 * 60) % 24;
			if (hourDiff < 1 || hourDiff > 23) return tourConfig[hour];
		}
	} catch (err) {
		return;
	}
}

function getScoreTourClass() {
	return class ScoreTournament extends Tournaments.Tournament {

		disqualifyUser(userid: ID, output: Chat.CommandContext | null = null, reason: string | null = null, isSelfDQ = false) {
			const player = this.playerTable[userid];
			// Find foe player
			let foe: TournamentPlayer | undefined;
			for (const playerFrom of this.players) {
				const match = playerFrom.inProgressMatch;
				if (match && match.to === player) foe = playerFrom;
			}
			foe = foe || player.inProgressMatch?.to;
			foe = foe || player.pendingChallenge?.from || player.pendingChallenge?.to;
			// Add score to foe
			if (foe) {
				foe.wins += 1;
				addTourScore(this.name, foe.id, foe.wins);
			}
			return super.disqualifyUser(userid, output, reason, isSelfDQ);
		}

		onBattleWin(room: GameRoom, winnerid: ID) {
			super.onBattleWin(room, winnerid);
			addTourScore(this.name, winnerid, this.playerTable[winnerid].wins);
		}

	}
}

// function updateUserAlts(): string {

// }

export function getMainId(userid: string): string {
	// Users.get(userid)?.ips
	return userid;
}

function addTourScore(tourname: string, userid: string, wins: number) {
	let score = 0;
	switch (wins) {
		case 2:
		case 3:
		case 4:
			score = 10;
			break;
		case 5:
		case 6:
			score = 20;
	}
	if (score > 0) {
		addScoreToMain(userid, score, `{}在 ${tourname} 淘汰赛中连胜 ${wins} 轮`);
	}
}

export async function addScoreToMain(userid: string, score: number, msg: string) {
	const mainId = getMainId(userid);
	const isMain = mainId === userid;
	const userExists = !!(await addScore(mainId, 0))[0];
	// Temp
	if (!userExists) return Users.get(userid)?.popup(
		`${msg.replace('{}', '您')}, 应获得国服积分 ${score} 分。由于未查到您的国服积分记录, 请联系管理员为您加分。`
	);
	const scores = await addScore(userid, score);
	const logMsg = `${msg.replace('{}', userid)}国服积分: ${scores[0]} + ${score} = ${scores[1]}`;
	const entry: PartialModlogEntry = {
		action: logMsg,
		isGlobal: true,
		note: userExists ? '' : '新用户',
	};
	Rooms.global.modlog(entry);
	Rooms.get('staff')?.send(`|modaction|${logMsg}`);
	Users.get(userid)?.popup(
		`${msg.replace('{}', '您')}, 获得国服积分 ${score} 分${isMain ? '' : `, 已发放到您的主账号 ${mainId} 上`}`
	);
}

let addingScore: boolean = false;

export async function addScore(userid: string, score: number): Promise<number[]> {
	while (addingScore) await sleep(1);
	addingScore = true;
	// @ts-ignore
	let ladder = await Ladders("gen8ps").getLadder();
	let userIndex = ladder.length;
	for (let [i, entry] of ladder.entries()) {
		if (toID(userid) ? (toID(entry[2]) === toID(userid)) : (entry[2] === userid)) {
			userIndex = i;
			break;
		}
	}
	if (userIndex === ladder.length) ladder.push([userid, 0, userid, 0, 0, 0, '']);
	let oldScore = ladder[userIndex][1];
	if (score === 0) {
		addingScore = false;
		return [oldScore, oldScore];
	}
	let newScore = oldScore + score;
	if (newScore < 0) {
		addingScore = false;
		return [];
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

	// @ts-ignore
	Ladders("gen8ps").save();
	addingScore = false;
	return [oldScore, newScore];
}

export const commands: Chat.ChatCommands = {
	async pschinascore(target, room, user) {
		this.checkCan('lock');
		if (!room || !room.settings.staffRoom) return this.errorReply("在 Staff 房间更新PS国服积分");

		const userid = target.split(',')[0]?.trim();  // 等积分转移完成后改用toID()
		const score = target.split(',')[1]?.trim();
		const reason = target.split(',')[2]?.trim();
		if (!userid || !score || !reason || isNaN(parseInt(score))) {
			return this.parse("/pschinascorehelp");
		}
		const parsedScore = parseInt(score);
		const changeScore = await addScore(userid, parsedScore);
		if (changeScore.length !== 2) return this.errorReply("错误：将造成负分。");

		const CNUser = Users.get(userid);
		if (CNUser?.connected) {
			CNUser.popup(`您因为 ${reason} ${parsedScore > 0 ? '获得': '失去'}了 ${Math.abs(parsedScore)} 国服积分`);
		}
		const message = `用户ID: ${userid}, PS国服积分: ` +
			`${changeScore[0]} ${parsedScore < 0 ? "-" : "+"} ${Math.abs(parsedScore)} = ${changeScore[1]}, ` +
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
	},

	't': 'scoretour',
	scoretour(target, room, user) {
		this.checkCan('gdeclare');
		if (!room || room.roomid !== 'skypillar') return this.errorReply("请在 Sky Pillar 房间举办积分淘汰赛");
		if (room.tour) return this.errorReply("请等待正在进行的淘汰赛结束");
		const formatid = getTourFormat();
		if (!formatid) return this.errorReply("日程表中没有正要举行的比赛");		
		this.parse(`/globaldeclare Sky Pillar房间 ${formatid} 淘汰赛将于5分钟后开始, 连胜第2、3、4轮时奖励10积分, 连胜第5、6轮时奖励20积分`);
		this.parse(`/tour create ${formatid}, elimination`);
		this.parse(`/tour playercap 64`);
		this.parse(`/tour autostart 5`);
		this.parse(`/tour forcetimer on`);
		this.parse(`/tour autodq 2`);
		this.parse(`!formats ${formatid}`);
		const tour = room.getGame(Tournaments.Tournament);
		if (!tour) return this.errorReply("淘汰赛创建失败");
		tour.onBattleWin = getScoreTourClass().prototype.onBattleWin;
		tour.disqualifyUser = getScoreTourClass().prototype.disqualifyUser;
	},

	async updatealts(target, room, user) {
		return;
	}
};