import { FS } from "../../../lib";
import { PetModeGymConfig } from "../../../config/pet-mode/gym-config";

const USERPATH = 'config/pet-mode/user-properties';
const DEPOSITPATH = 'config/pet-mode/deposit';

const catchRate: {[speciesid: string]: number} = JSON.parse(FS('config/pet-mode/catch-rate.json').readIfExistsSync());
const catchStatusCorrection: {[statusid: string]: number} = {'': 1, 'psn': 1.5, 'par': 1.5, 'brn': 1.5, 'slp': 2.5, 'frz': 2.5};
const gymConfig: {[gymname: string]: {
	'maxlevel': number, 'botteam': string, 'userteam': string, 'ace': string,
	'bonus'?: string, 'terrain'?: string, 'weather'?: string,
	'msg': {'start': string, 'ace': string, 'win': string, 'lose': string}
}} = PetModeGymConfig;
const userToGym: {[userid: string]: string} = {};

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
	if (FS(`${DEPOSITPATH}/${userid}.txt`).readIfExistsSync() !== badgename) return false;
	let userProperty = JSON.parse(FS(`${USERPATH}/${userid}.json`).readIfExistsSync());
	if (userProperty['badges'].indexOf(badgename) < 0) {
		userProperty['badges'].push(badgename);
		FS(`${USERPATH}/${userid}.json`).writeSync(JSON.stringify(userProperty));
		return true;
	}
	return false;
}

function addBox(userid: string) {
	let userProperty = JSON.parse(FS(`${USERPATH}/${userid}.json`).readIfExistsSync());
	userProperty['box'] = userProperty['box'].concat(new Array(30).fill(''));
	FS(`${USERPATH}/${userid}.json`).writeSync(JSON.stringify(userProperty));
}

function registerUser(userid: string): string | undefined {
	let gymName = FS(`${DEPOSITPATH}/${userid}.txt`).readIfExistsSync();
	if (gymConfig[gymName]) {
		userToGym[userid] = gymName;
		return gymName;
	}
}

function checkWin(pokemonOnFaint: Pokemon, sides: Side[]): string | undefined {
	const aliveSides = sides.filter(side => {
		return side.pokemon.filter(pokemon => !pokemon.fainted).length > (pokemonOnFaint.side.id === side.id ? 1 : 0);
	});
	if (aliveSides.length === 1) return aliveSides[0].id;
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
			const botSide = this.sides[1];
			botSide.emitRequest = (update: AnyObject) => {
				this.send('sideupdate', `${botSide.id}\n|request|${JSON.stringify(update)}`);
				botSide.activeRequest = update;
				setTimeout(() => {
					for (let i = 0; i < 20; i++) {
						botSide.chooseMove(this.sample(botSide.active[0].moves));
						if (botSide.isChoiceDone()) break;
					}
				}, 10);
			}
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

	pschinapetmodegym: {
		name: 'PS China Pet Mode Gym',
		ruleset: ['Sleep Clause Mod'],
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
			const userName = this.sides[0].name;
			const gymName = registerUser(Dex.toID(userName));
			if (!gymName) return;
			const gymSettings = gymConfig[gymName];
			const botSide = this.sides[1];
			botSide.emitRequest = (update: AnyObject) => {
				this.send('sideupdate', `${botSide.id}\n|request|${JSON.stringify(update)}`);
				botSide.activeRequest = update;
				setTimeout(() => {
					if (update.forceSwitch) {
						const alive = botSide.pokemon.filter(
							x => !x.isActive && !x.fainted && x.species.name !== gymSettings['ace']
						).map(x => x.name);
						if (alive.length > 0) {
							botSide.chooseSwitch(this.prng.sample(alive));
						} else {
							botSide.chooseSwitch(gymSettings['ace']);
							this.add('message', gymSettings['msg']['ace']);
						}
						if (this.allChoicesDone()) {
							this.commitDecisions();
							this.sendUpdates();
						}
					} else {
						const activePoke = botSide.active[0];
						const foeActivePoke = this.sides[0].active[0];
						const hpRate = activePoke.hp / activePoke.maxhp;
						const healPress = activePoke.speed > foeActivePoke.speed ? 1 : 2;
						const healRate = Math.pow(1 - hpRate, 3) + 3 * Math.pow(1 - hpRate, 2) * hpRate * healPress;
						const mega = activePoke.canMegaEvo ? 'mega' : '';
						if (this.prng.randomChance(healRate * 1000, 1000)) {
							const healingMove = activePoke.moves.filter(moveid => {
								return Dex.moves.get(moveid).flags['heal'];
							})[0];
							if (healingMove) botSide.chooseMove(healingMove, 0, mega);
						}
						if (Math.max(...Object.values(foeActivePoke.boosts)) >= 2) {
							if (activePoke.hasMove('spectralthief')) {
								botSide.chooseMove('spectralthief', 0, mega);
							} else {
								const thief = botSide.pokemon.filter(x => {
									return !x.fainted && x.hasMove('spectralthief');
								})[0];
								if (thief) botSide.chooseSwitch(thief.name);
							}
						}
						let i = 0;
						const validMoves = activePoke.getMoves().filter(movedata => {
							return movedata.pp && !Dex.moves.get(movedata.move).flags['heal'];
						}).map(movedata => movedata.move);
						while (!botSide.isChoiceDone() && i < 20) {
							botSide.chooseMove(this.sample(validMoves), 0, mega);
							i++;
						}
					}
				}, 10);
			};
			this.add('html', `<div class="broadcast-green"><strong>训练家${userName}开始挑战${gymName}道馆!</strong></div>`);
		},
		onBattleStart() {
			const gymName = userToGym[Dex.toID(this.sides[0].name)];
			if (gymName) this.add('message', gymConfig[gymName]['msg']['start']);
		},
		onBeforeTurn() {
			const gymName = userToGym[Dex.toID(this.sides[0].name)];
			if (!gymName) return;
			const gymSettings = gymConfig[gymName];
			if (gymSettings['weather']) this.field.setWeather(gymSettings['weather']);
			if (gymSettings['terrain']) this.field.setTerrain(gymSettings['terrain']);
		},
		onFaint(pokemon) {
			const userId = Dex.toID(this.sides[0].name);
			const gymName = userToGym[userId];
			const gymSettings = gymConfig[gymName];
			if (!gymName) return;
			switch (checkWin(pokemon, this.sides)) {
				case 'p1':
					if (addBadge(userId, gymName)) {
						this.add('html', `<div class="broadcast-green"><strong>恭喜您获得了 ${gymName}徽章 !</strong></div>`);
						switch (gymSettings['bonus']) {
							case 'box':
								addBox(userId);
								this.add('html', `<div class="broadcast-green"><strong>您获得了一个新的盒子! 快去查看吧!</strong></div>`);
								break;
						}
					}
					this.add('message', gymSettings['msg']['win']);
					delete userToGym[userId];
					break;
				case 'p2':
					this.add('message', gymSettings['msg']['lose']);
					delete userToGym[userId];
					break;
			}
		}
	},

};
