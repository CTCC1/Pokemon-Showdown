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
	let userProperty= JSON.parse(FS(`${USERPATH}/${userid}.json`).readIfExistsSync());
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
			newLevel = Math.min(newLevel, userProperty['badges'].length * 10 + 30);
			features[10] = newLevel >= 100 ? '' : newLevel.toString();
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

export const Rulesets: {[k: string]: FormatData} = {
	pschinapetmode: {
		name: 'PS China Pet Mode',
		ruleset: ['Dynamax Clause'],
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
			this.sides.forEach(side => {
				if (Dex.toID(side.name) === BOTID) {
					this.add('html', `<div class="broadcast-green"><strong>野生的${side.team[0].name}出现了!</strong></div>`);
				}
			})
		},
		onBattleStart() {
			this.sides.forEach(side => {
				if (Dex.toID(side.name) === BOTID) {
					this.add('html', `<button class="button" name="send" value="/pet lawn ball">捕捉!</button>`);
					const userid = Dex.toID(this.sides[2 - parseInt(side.id[1])].name);
					writeCatchRate(userid, side.pokemon[0].species.id, 1, 1, '');
				}
			})
		},
		onBeforeTurn(pokemon) {
			if (Dex.toID(pokemon.side.name) === BOTID) {
				this.add('html', `<button class="button" name="send" value="/pet lawn ball">捕捉!</button>`);
				const userid = Dex.toID(this.sides[2 - parseInt(pokemon.side.id[1])].name);
				writeCatchRate(userid, pokemon.species.id, pokemon.hp, pokemon.maxhp, pokemon.status);
			}
		},
		onFaint(pokemon) {
			if (Dex.toID(pokemon.side.name) === BOTID) {
				this.add('html', `<div class="broadcast-green"><strong>野生的${pokemon.name}倒下了!</strong></div>`);
				let levelUp = false;
				this.sides.forEach(side => {
					const userid = Dex.toID(side.name);
					if (userid !== BOTID) levelUp = levelUp || addExperience(userid, pokemon.species.name, pokemon.level);
				});
				if (levelUp) {
					this.add('html', `<div class="broadcast-green"><strong>您的宝可梦升级了! 快去盒子查看吧!</strong></div>`);
				}
			} else {
				this.add('html', `<div class="broadcast-red"><strong>${pokemon.name}倒下了!</strong></div>`);
			}
		},
	},
	pschinapetmodegym1: {
		name: 'PS China Pet Mode',
		ruleset: ['Dynamax Clause'],
		timer: {
			starting: 600,
			addPerTurn: 0,
			maxPerTurn: 60,
			maxFirstTurn: 60,
			grace: 0,
			timeoutAutoChoose: true,
			dcTimerBank: false,
		},
		onBegin() {
			this.sides.forEach(side => {
				if (Dex.toID(side.name) !== BOTID) {
					for (const pokemon of side.pokemon) {
						pokemon.level = Math.min(pokemon.level, 10);
					}
					this.add('html', `<div class="broadcast-green"><strong>训练家${side.name}开始挑战一号道馆!</strong></div>`);
				}
			})
		},
		// onFaint(pokemon) {
		// 	if (pokemon.side.name === BOTID) {
		// 		if pokemon.hp
				
		// 	}
		// }
	}
};
