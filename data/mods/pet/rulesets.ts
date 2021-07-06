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
			const botSide = this.sides[1];
			botSide.emitRequest = (update: AnyObject) => {
				this.send('sideupdate', `${botSide.id}\n|request|${JSON.stringify(update)}`);
				botSide.activeRequest = update;
				setTimeout(() => {
					if (update.forceSwitch) {
						const alive = botSide.pokemon.filter(
							x => !x.isActive && !x.fainted && x.name !== 'Oricorio'
						).map(x => x.name);
						if (alive.length > 0) {
							botSide.chooseSwitch(this.prng.sample(alive));
						} else {
							botSide.chooseSwitch('Oricorio-Sensu');
							this.add('message', '要进入高潮咯，希望你能跟上我的步伐');
						}
						this.commitDecisions();
						if (this.allChoicesDone()) this.sendUpdates();
					} else {
						for (let i = 0; i < 20; i++) {
							botSide.chooseMove(this.sample(botSide.active[0].moves));
							if (botSide.isChoiceDone()) break;
						}
					}
				}, 10);
			};
			this.sides.forEach(side => {
				if (Dex.toID(side.name) === BOTID) {
					this.add('html', `<div class="broadcast-green"><strong>训练家${side.name}开始挑战苍蓝道馆!</strong></div>`);
				}
			})
		},
		onBattleStart() {
			this.add('message', '欢迎来到，新人训练家都要经过的第一站——苍蓝道馆。来吧，让我们一起在苍蓝的天空起舞吧。');
		},
		onFaint(pokemon) {
			if (pokemon.side.id === 'p2' && pokemon.side.pokemon.filter(pokemon => !pokemon.fainted).length <= 1) {
				if (addBadge(Dex.toID(this.sides[0].name), '苍蓝')) {
					this.add('html', `<div class="broadcast-green"><strong>恭喜您获得了 苍蓝徽章 !</strong></div>`);
				}
				this.add('message', '真是一场美妙的舞会，没想到你作为新人训练家竟如此出色。这枚苍蓝徽章是你应得的，收下他吧。');
			}
			if (pokemon.side.id === 'p1' && pokemon.side.pokemon.filter(pokemon => !pokemon.fainted).length <= 1) {
				this.add('message', '学会飞行最难的就是第一次振翅的勇气，请再接再厉，这片天空属于未来的你们');
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
			const botSide = this.sides[1];
			botSide.emitRequest = (update: AnyObject) => {
				this.send('sideupdate', `${botSide.id}\n|request|${JSON.stringify(update)}`);
				botSide.activeRequest = update;
				setTimeout(() => {
					if (update.forceSwitch) {
						const alive = botSide.pokemon.filter(
							x => !x.isActive && !x.fainted && x.name !== 'Keldeo'
						).map(x => x.name);
						if (alive.length > 0) {
							botSide.chooseSwitch(this.prng.sample(alive));
						} else {
							botSide.chooseSwitch('Keldeo-Resolute');
							this.add('message', '决心。。。你的决心又是什么呢？');
						}
						this.commitDecisions();
						if (this.allChoicesDone()) this.sendUpdates();
					} else {
						for (let i = 0; i < 20; i++) {
							botSide.chooseMove(this.sample(botSide.active[0].moves));
							if (botSide.isChoiceDone()) break;
						}
					}
				}, 10);
			};
			this.sides.forEach(side => {
				if (Dex.toID(side.name) === BOTID) {
					this.add('html', `<div class="broadcast-green"><strong>训练家${side.name}开始挑战湛蓝道馆!</strong></div>`);
				}
			})
		},
		onBattleStart() {
			this.add('message', '经历过天空洗礼的你，能否经得住波涛的汹涌呢？');
		},
		onFaint(pokemon) {
			if (pokemon.side.id === 'p2' && pokemon.side.pokemon.filter(pokemon => !pokemon.fainted).length <= 1) {
				if (addBadge(Dex.toID(this.sides[0].name), '湛蓝')) {
					this.add('html', `<div class="broadcast-green"><strong>恭喜您获得了 湛蓝徽章 !</strong></div>`);
				}
				this.add('message', '天空，海洋，下一个就是冰雪。。。。没什么，自言自语罢了。收下吧，这是湛蓝徽章，曾经我也是这么一步步走来的，希望有一天你也能看到山顶的风景');
			}
			if (pokemon.side.id === 'p1' && pokemon.side.pokemon.filter(pokemon => !pokemon.fainted).length <= 1) {
				this.add('message', '海洋固然广阔，但只要你愿意扬帆，不畏波涛，就一定能驶向远方，请再接再厉。');
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
			const botSide = this.sides[1];
			botSide.emitRequest = (update: AnyObject) => {
				this.send('sideupdate', `${botSide.id}\n|request|${JSON.stringify(update)}`);
				botSide.activeRequest = update;
				setTimeout(() => {
					if (update.forceSwitch) {
						const alive = botSide.pokemon.filter(
							x => !x.isActive && !x.fainted && x.name !== 'Articuno'
						).map(x => x.name);
						if (alive.length > 0) {
							botSide.chooseSwitch(this.prng.sample(alive));
						} else {
							botSide.chooseSwitch('Articuno');
							this.add('message', '曾经我也是为他所救的一人，也是在这次建立起了我们的羁绊。');
						}
						this.commitDecisions();
						if (this.allChoicesDone()) this.sendUpdates();
					} else {
						const mega = botSide.active[0].canMegaEvo ? 'mega' : '';
						for (let i = 0; i < 20; i++) {
							botSide.chooseMove(this.sample(botSide.active[0].moves), 0, mega);
							if (botSide.isChoiceDone()) break;
						}
					}
				}, 10);
			};
			this.sides.forEach(side => {
				if (Dex.toID(side.name) === BOTID) {
					this.add('html', `<div class="broadcast-green"><strong>训练家${side.name}开始挑战冰蓝道馆!</strong></div>`);
				}
			})
		},
		onBattleStart() {
			this.add('message', '这里是蓝色三馆的最后一站。在雪山当中最致命就是无尽的暴风雪与冰雹，但愿你能冲破这重重的险阻。');
		},
		onBeforeTurn() {
			this.field.setWeather('hail');
		},
		onFaint(pokemon) {
			if (pokemon.side.id === 'p2' && pokemon.side.pokemon.filter(pokemon => !pokemon.fainted).length <= 1) {
				if (addBadge(Dex.toID(this.sides[0].name), '冰蓝')) {
					this.add('html', `<div class="broadcast-green"><strong>恭喜您获得了 冰蓝徽章 !</strong></div>`);
				}
				this.add('message', '飞跃苍穹，不畏浩瀚，勇登高峰，这样的你已经完全是一个合格的训练师了。加油，更广阔的的天地在等待着你。');
			}
			if (pokemon.side.id === 'p1' && pokemon.side.pokemon.filter(pokemon => !pokemon.fainted).length <= 1) {
				this.add('message', '暴风雪是最容易让人迷失方向的地方，但我相信只要你心中有着指引你的方向就一定不会迷茫，希望下次能让我看到更加强大的你。');
			}
		}
	},

	pschinapetmodegym4: {
		name: 'PS China Pet Mode Gym4',
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
			const botSide = this.sides[1];
			botSide.emitRequest = (update: AnyObject) => {
				this.send('sideupdate', `${botSide.id}\n|request|${JSON.stringify(update)}`);
				botSide.activeRequest = update;
				setTimeout(() => {
					if (update.forceSwitch) {
						const alive = botSide.pokemon.filter(
							x => !x.isActive && !x.fainted && x.name !== 'Metagross'
						).map(x => x.name);
						if (alive.length > 0) {
							botSide.chooseSwitch(this.prng.sample(alive));
						} else {
							botSide.chooseSwitch('Metagross');
							this.add('message', '这是最后的试炼。来吧！让我看看你修行的成果。');
						}
						this.commitDecisions();
						if (this.allChoicesDone()) this.sendUpdates();
					} else {
						const mega = botSide.active[0].canMegaEvo ? 'mega' : '';
						for (let i = 0; i < 20; i++) {
							botSide.chooseMove(this.sample(botSide.active[0].moves), 0, mega);
							if (botSide.isChoiceDone()) break;
						}
					}
				}, 10);
			};
			this.sides.forEach(side => {
				if (Dex.toID(side.name) === BOTID) {
					this.add('html', `<div class="broadcast-green"><strong>训练家${side.name}开始挑战坚毅道馆!</strong></div>`);
				}
			})
		},
		onBattleStart() {
			this.add('message', '这里是勇者修行的第一站，与之前相比，这里的修行恐怕会更加的令人绝望。穿上这件磁力服，在这里，坚定的意志将使属性克制不再那么重要，不过如果想要偷懒回复的话，可要做好被场地电击打断的准备。');
		},
		onBeforeTurn() {
			this.field.setTerrain('steelterrain');
		},
		onFaint(pokemon) {
			if (pokemon.side.id === 'p2' && pokemon.side.pokemon.filter(pokemon => !pokemon.fainted).length <= 1) {
				if (addBadge(Dex.toID(this.sides[0].name), '坚毅')) {
					this.add('html', `<div class="broadcast-green"><strong>恭喜您获得了 坚毅徽章 !</strong></div>`);
					addBox(Dex.toID(this.sides[0].name));
					this.add('html', `<div class="broadcast-green"><strong>您获得了一个新的盒子! 快去查看吧!</strong></div>`)
				}
				this.add('message', '这是坚毅的证明，希望你和你的宝可梦能记住这段时间修行的成果。顺便帮我向那个老太婆打个招呼，可别被她的小伎俩给蒙住了眼睛。');
			}
			if (pokemon.side.id === 'p1' && pokemon.side.pokemon.filter(pokemon => !pokemon.fainted).length <= 1) {
				this.add('message', '小子，连这第一关都过不去，还想成为顶尖的训练师？');
			}
		}
	}

};
