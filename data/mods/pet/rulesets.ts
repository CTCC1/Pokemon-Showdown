import { FS } from "../../../lib";

const BOTID = 'pschinabot';
const USERPATH = 'config/pet-mode/user-properties';
const DEPOSITPATH = 'config/pet-mode/deposit';

const catchRate: {[speciesid: string]: number} = JSON.parse(FS('config/pet-mode/catch-rate.json').readIfExistsSync());
const catchStatusCorrection: {[statusid: string]: number} = {'': 1, 'psn': 1.5, 'par': 1.5, 'brn': 1.5, 'slp': 2.5, 'frz': 2.5};

function argmax(s: StatsTable): 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe' {
	let maxValue = 0;
	let maxIndex: 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe' = 'hp';
	let i: 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
	for (i in s) {
		if (s[i] > maxValue) {
			maxValue = s[i];
			maxIndex = i;
		}
	}
	return maxIndex;
}

function addExperience(userid: string, foespecies: string, foelevel: number): boolean {
	let levelUp = false;
	let userProperty = JSON.parse(FS(`${USERPATH}/${userid}.json`).readIfExistsSync());
	const len = userProperty['bag'].length;
	for (let index in userProperty['bag']) {
		const ownPoke = userProperty['bag'][index];
		if (ownPoke) {
			let features = ownPoke.split('|');
			let level = parseFloat(features[10]) || 100;
			// 经验 = sqrt(100 * foeLevel) * foeBst / log3(team.length + 2)
			// level + 1 所需经验 = level * bst * 1.5
			const foespec = Dex.species.get(foespecies);
			const foebst = foespec.bst;
			if (level < userProperty['badges'].length * 10 + 10) {
				let experience = Math.sqrt(100 * foelevel) * foebst / (Math.log(len + 2) / Math.log(3));
				const bst = Dex.species.get(features[1] || features[0]).bst;
				const needExp = (l: number) => Math.floor(l) * bst * 1.5;
				let need = needExp(level);
				let newLevel = level + experience / need;
				while (Math.floor(newLevel) > Math.floor(level)) {
					experience = experience - need;
					level += 1;
					levelUp = true;
					need = needExp(level);
					newLevel = level + experience / need;
				}
				features[10] = newLevel >= 100 ? '' : newLevel.toString();
			}
			const evs = (features[6] || ',,,,,').split(',').map((x: string) => parseInt(x) || 0);
			const maxEvsIndex = argmax(foespec.baseStats);
			const f = Object.keys(foespec.baseStats).indexOf(maxEvsIndex);
			const s = Math.floor(foespec.baseStats[maxEvsIndex] / 40) * 4;
			evs[f] = evs[f] + Math.max(Math.min(s, 252 - evs[f], 510 - eval(evs.join('+'))), 0);
			features[6] = evs.join(',');
			features[11] = Math.min((features[11] ? parseInt(features[11]) : 255) + 10, 255).toString();
			userProperty['bag'][index] = features.join('|');
		}
	}
	FS(`${USERPATH}/${userid}.json`).writeSync(JSON.stringify(userProperty));
	return levelUp;
}

function writeCatchRate(userid: string, speciesid: string, hp: number, maxhp: number, status: string) {
	const R = (1 - hp / maxhp / 1.5) * (catchRate[speciesid] || 3) * (catchStatusCorrection[status] || 1);
	FS(`${DEPOSITPATH}/${userid}.txt`).safeWriteSync(Math.floor(R).toString());
}

function addBadge(userid: string, badgename: string): boolean {
	let userProperty = JSON.parse(FS(`${USERPATH}/${userid}.json`).readIfExistsSync());
	if (userProperty['badges'].indexOf(badgename) < 0) {
		userProperty['badges'].push(badgename);
		FS(`${USERPATH}/${userid}.json`).writeSync(JSON.stringify(userProperty));
		return true;
	}
	return false;
}

export const Rulesets: {[k: string]: FormatData} = {

	pschinapetmode: {
		name: 'PS China Pet Mode',
		ruleset: ['Dynamax Clause'],
	},

	pschinapetmodewild: {
		name: 'PS China Pet Mode Wild',
		timer: {
			starting: 120,
			addPerTurn: 0,
			maxPerTurn: 15,
			maxFirstTurn: 15,
			grace: 0,
			timeoutAutoChoose: true,
			dcTimerBank: false,
		},
		onBegin() {
			this.add('html', `<div class="broadcast-green"><strong>野生的${this.sides[1].team[0].name}出现了!</strong></div>`);
		},
		onBattleStart() {
			this.add('html', `<button class="button" name="send" value="/pet lawn ball">捕捉!</button>`);
			const userid = Dex.toID(this.sides[0].name);
			writeCatchRate(userid, this.sides[1].pokemon[0].species.id, 1, 1, '');
		},
		onBeforeTurn(pokemon) {
			if (pokemon.side.id === 'p2') {
				this.add('html', `<button class="button" name="send" value="/pet lawn ball">捕捉!</button>`);
				const userid = Dex.toID(this.sides[2 - parseInt(pokemon.side.id[1])].name);
				writeCatchRate(userid, pokemon.species.id, pokemon.hp, pokemon.maxhp, pokemon.status);
			}
		},
		onFaint(pokemon) {
			if (pokemon.side.id === 'p2') {
				this.add('html', `<div class="broadcast-green"><strong>野生的${pokemon.name}倒下了!</strong></div>`);
				let levelUp = false;
				levelUp = levelUp || addExperience(Dex.toID(this.sides[0].name), pokemon.species.name, pokemon.level);
				if (levelUp) {
					this.add('html', `<div class="broadcast-green"><strong>您的宝可梦升级了! 快去盒子查看吧!</strong></div>`);
				}
			} else {
				this.add('html', `<div class="broadcast-red"><strong>${pokemon.name}倒下了!</strong></div>`);
			}
		},
	},

	pschinapetmodegym1: {
		name: 'PS China Pet Mode Gym1',
		ruleset: ['Evasion Moves Clause'],
		timer: {
			starting: 600,
			addPerTurn: 30,
			maxPerTurn: 60,
			maxFirstTurn: 60,
			grace: 0,
			timeoutAutoChoose: true,
			dcTimerBank: false,
		},
		onBegin() {
			this.sides.forEach(side => {
				if (Dex.toID(side.name) === BOTID) {
					this.add('html', `<div class="broadcast-green"><strong>训练家${side.name}开始挑战苍蓝道馆!</strong></div>`);
				}
			})
		},
		onFaint(pokemon) {
			if (pokemon.side.id === 'p2' && pokemon.side.pokemon.filter(pokemon => !pokemon.fainted).length <= 1) {
				if (addBadge(Dex.toID(this.sides[0].name), '苍蓝')) {
					this.add('html', `<div class="broadcast-green"><strong>恭喜您获得了 苍蓝徽章 !</strong></div>`);
				}
			}
		}
	},

	pschinapetmodegym2: {
		name: 'PS China Pet Mode Gym2',
		ruleset: ['Evasion Moves Clause', 'Sleep Clause Mod'],
		timer: {
			starting: 600,
			addPerTurn: 30,
			maxPerTurn: 60,
			maxFirstTurn: 60,
			grace: 0,
			timeoutAutoChoose: true,
			dcTimerBank: false,
		},
		onBegin() {
			this.sides.forEach(side => {
				if (Dex.toID(side.name) === BOTID) {
					this.add('html', `<div class="broadcast-green"><strong>训练家${side.name}开始挑战湛蓝道馆!</strong></div>`);
				}
			})
		},
		onFaint(pokemon) {
			if (pokemon.side.id === 'p2' && pokemon.side.pokemon.filter(pokemon => !pokemon.fainted).length <= 1) {
				if (addBadge(Dex.toID(this.sides[0].name), '湛蓝')) {
					this.add('html', `<div class="broadcast-green"><strong>恭喜您获得了 湛蓝徽章 !</strong></div>`);
				}
			}
		}
	},

	pschinapetmodegym3: {
		name: 'PS China Pet Mode Gym3',
		ruleset: ['Evasion Moves Clause', 'Sleep Clause Mod'],
		timer: {
			starting: 600,
			addPerTurn: 30,
			maxPerTurn: 60,
			maxFirstTurn: 60,
			grace: 0,
			timeoutAutoChoose: true,
			dcTimerBank: false,
		},
		onBegin() {
			this.sides.forEach(side => {
				if (Dex.toID(side.name) === BOTID) {
					this.add('html', `<div class="broadcast-green"><strong>训练家${side.name}开始挑战冰蓝道馆!</strong></div>`);
				}
			})
		},
		onBeforeTurn() {
			this.field.setWeather('hail');
		},
		onFaint(pokemon) {
			if (pokemon.side.id === 'p2' && pokemon.side.pokemon.filter(pokemon => !pokemon.fainted).length <= 1) {
				if (addBadge(Dex.toID(this.sides[0].name), '冰蓝')) {
					this.add('html', `<div class="broadcast-green"><strong>恭喜您获得了 冰蓝徽章 !</strong></div>`);
				}
			}
		}
	}

};
