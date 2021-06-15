import { FS } from "../../../lib";

const BOTID = 'pschinabot';
const USERPATH = 'config/pet-mode/user-properties';

function hash(s: string): number {
	let hash = 0, i, chr;
	if (s.length === 0) return hash;
	for (i = 0; i < s.length; i++) {
		chr   = s.charCodeAt(i);
		hash  = ((hash << 5) - hash) + chr;
		hash |= 0;
	}
	return hash;
};

function addExperience(userid: string, foespecies: string, foelevel: number): boolean {
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
			const evs = (features[6] || ',,,,,').split(',').map((x: string) => parseInt(x) || 0);
			const f = Math.abs(hash(foespecies)) % 6;
			evs[f] = evs[f] + Math.max(Math.min(10, 252 - evs[f], 510 - eval(evs.join('+'))), 0);
			features[6] = evs.join(',');
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
					this.add('html', `<div class="broadcast-green"><strong>野生的${side.team[0].name}出现了!</strong></div>`);
				}
			})
		},
		onBattleStart() {
			if (Dex.toID(this.sides[0].name) === BOTID || Dex.toID(this.sides[1].name) === BOTID) {
				this.add('html', `<button class="button" name="send" value="/pet lawn ball">捕捉!</button>`);
			}
		},
		onBeforeTurn(pokemon) {
			if (Dex.toID(pokemon.side.name) === BOTID) {
				this.add('html', `<button class="button" name="send" value="/pet lawn ball">捕捉!</button>`);
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
};
