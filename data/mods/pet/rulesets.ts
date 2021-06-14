import { FS } from "../../../lib";

const USERPATH = 'config/pet-mode/user-properties';

export const Rulesets: {[k: string]: FormatData} = {
	pschinapetmode: {
		name: 'PS China Pet Mode',
		ruleset: ['Dynamax Clause'],
		onBegin() {
			this.sides.forEach(side => {
				if (Dex.toID(side.name) === 'pschinabot') {
					this.add('html', `<div class="broadcast-green"><strong>野生的${side.team[0].name}出现了！</strong></div>`);
				}
			})
		},
		onBeforeTurn(pokemon) {
			if (Dex.toID(pokemon.side.name) === 'pschinabot') {
				this.add('html', `<button class="button" name="send" value="/pet lawn ball">捕捉！</button>`);
			}
		},
		onFaint(pokemon) {
			if (Dex.toID(pokemon.side.name) === 'pschinabot') {
				this.add('html', `<div class="broadcast-green"><strong>野生的${pokemon.name}倒下了！</strong></div>`);
				let levelUp = false;
				this.sides.forEach(side => {
					const userid = Dex.toID(side.name);
					if (userid !== 'pschinabot') {
						let userProperty= JSON.parse(FS(`${USERPATH}/${userid}.json`).readIfExistsSync());
						for (let index in userProperty['bag']) {
							const ownPoke = userProperty['bag'][index];
							if (ownPoke) {
								let features = ownPoke.split('|');
								let level = parseFloat(features[10]) || 100;
								if (level) {
									const bst = eval(Object.values(Dex.species.get(features[1] || features[0]).baseStats).join('+'));
									const newLevel = level + (pokemon.level / level / level * 10) * (300 / bst);
									levelUp = levelUp || Math.floor(newLevel) - Math.floor(level) > 0;
									if (level >= 100) {
										features[10] = '';
									} else {
										features[10] = newLevel.toString();
									}
								}
								let evs = (features[6] || ',,,,,').split(',').map((x: string) => parseInt(x) || 0);
								features[6] = evs.map((x: number) => Math.min(x + 1, 255)).join(',');
								userProperty['bag'][index] = features.join('|');
							}
						}
						FS(`${USERPATH}/${userid}.json`).writeSync(JSON.stringify(userProperty));
					}
				});
				if (levelUp) {
					this.add('html', `<div class="broadcast-green"><strong>您的宝可梦升级了！快去盒子查看吧！</strong></div>`);
				}
			} else {
				this.add('html', `<div class="broadcast-red"><strong>${pokemon.name}倒下了！</strong></div>`);
			}
		},
	},
};
