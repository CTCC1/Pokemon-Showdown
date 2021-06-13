import { FS } from "../../../lib";

const USERPATH = 'config/pet-mode/user-properties';

export const Rulesets: {[k: string]: FormatData} = {
	pschinapetmode: {
		name: 'PS China Pet Mode',
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
							const pokemon = userProperty['bag'][index];
							if (pokemon) {
								let features = pokemon.split('|');
								let level = parseInt(features[10]);
								if (level) {
									level += 1;
									levelUp = true;
									if (level >= 100) {
										features[10] = '';
									} else {
										features[10] = level.toString();
									}
									userProperty['bag'][index] = features.join('|');
								}
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
		}
	},
};
