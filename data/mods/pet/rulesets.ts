import { FS } from "../../../lib";
import { PRNG } from "../../../sim";

const prng = new PRNG();
const BOTID = 'pschinabot';
const USERPATH = 'config/pet-mode/user-properties';

function addExperience(userid: string, foelevel: number): boolean {
	let levelUp = false;
	let userProperty= JSON.parse(FS(`${USERPATH}/${userid}.json`).readIfExistsSync());
	for (let index in userProperty['bag']) {
		const ownPoke = userProperty['bag'][index];
		if (ownPoke) {
			let features = ownPoke.split('|');
			let level = parseFloat(features[10]) || 100;
			if (level) {
				const bst = eval(Object.values(Dex.species.get(features[1] || features[0]).baseStats).join('+'));
				const newLevel = level + (foelevel / level / level * 10) * (300 / bst);
				levelUp = levelUp || Math.floor(newLevel) - Math.floor(level) > 0;
				if (level >= 100) {
					features[10] = '';
				} else {
					features[10] = newLevel.toString();
				}
			}
			let evs = (features[6] || ',,,,,').split(',').map((x: string) => parseInt(x) || 0);
			features[6] = evs.map((x: number) => Math.min(x + prng.sample([1, 2, 3]), 255)).join(',');
			features[11] = Math.min((features[11] ? parseInt(features[11]) : 255) + 10, 255).toString();
			userProperty['bag'][index] = features.join('|');
		}
	}
	FS(`${USERPATH}/${userid}.json`).writeSync(JSON.stringify(userProperty));
	return levelUp;
}

export const Rulesets: {[k: string]: FormatData} = {
	pschinapetmode: {
		name: 'PS China Pet Mode',
		ruleset: ['Dynamax Clause'],
		onBegin() {
			this.sides.forEach(side => {
				if (Dex.toID(side.name) === BOTID) {
					this.add('html', `<div class="broadcast-green"><strong>野生的${side.team[0].name}出现了！</strong></div>`);
				}
			})
		},
		onBattleStart() {
			if (Dex.toID(this.sides[0].name) === BOTID || Dex.toID(this.sides[1].name) === BOTID) {
				this.add('html', `<button class="button" name="send" value="/pet lawn ball">捕捉！</button>`);
			}
		},
		onBeforeTurn(pokemon) {
			if (Dex.toID(pokemon.side.name) === BOTID) {
				this.add('html', `<button class="button" name="send" value="/pet lawn ball">捕捉！</button>`);
			}
		},
		onFaint(pokemon) {
			if (Dex.toID(pokemon.side.name) === BOTID) {
				this.add('html', `<div class="broadcast-green"><strong>野生的${pokemon.name}倒下了！</strong></div>`);
				let levelUp = false;
				this.sides.forEach(side => {
					const userid = Dex.toID(side.name);
					if (userid !== BOTID) levelUp = levelUp || addExperience(userid, pokemon.level);
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
