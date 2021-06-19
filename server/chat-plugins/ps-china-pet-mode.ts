/*
	Pokemon Showdown China Pet Mode Version 1.0 Author: Starmind
	1. 机器人重连后继续战斗
	2. 不对称Timer
X	3. 改名
X	4. Box UI: title, 昵称, 移动, 交换, 进化, 招式, 放生, 返回
	5. 徽章
X	6. 道具分类 (挖石头)
X	7. 清努力个体
	8. 道馆
	9. 机器人定时开tour
	10. Bottle Cap & Gold Bottle Cap
X	11. 领取随机道具
X	12. 领取礼物
	13. 交换 (国服积分)
*/

import { FS } from "../../lib";
import { PRNG } from "../../sim";
import { addScore } from "./ps-china-admin";
import { PetModeLearnSets } from "../../config/pet-mode/learnsets";
import { PokemonIconIndexes } from "../../config/pet-mode/poke-num";
import { PetModeRoomConfig } from "../../config/pet-mode/room-config";
import { PetModeShopConfig } from "../../config/pet-mode/shop-config";

type userProperty = {
	'bag': string[],
	'box': string[],
	'items': {[itemName: string]: number},
	'badges': string[],
	'time': {'ball': number, 'draw': number, 'search': number}
};
type petPosition = {'type': 'bag' | 'box', 'index': number};
type statPosition = {'type': 'ivs' | 'evs', 'index': 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe'};

const prng = new PRNG();

const BOTID = 'pschinabot';
const USERPATH = 'config/pet-mode/user-properties';
const GIFTPATH = 'config/pet-mode/user-gifts'
const POKESHEET = 'https://play.pokemonshowdown.com/sprites/pokemonicons-sheet.png';
const POKESPRITES = 'https://play.pokemonshowdown.com/sprites/ani';
const POKESPRITESSHINY = 'https://play.pokemonshowdown.com/sprites/ani-shiny';
const ITEMSHEET = 'https://play.pokemonshowdown.com/sprites/itemicons-sheet.png';
const TYPEICONS = 'https://play.pokemonshowdown.com/sprites/types';
const CATICONS = 'https://play.pokemonshowdown.com/sprites/categories';

const LAWNCD = 60000;
const BALLCD = 600000;

if (!FS(USERPATH).existsSync()) FS(USERPATH).mkdir();
if (!FS(GIFTPATH).existsSync()) FS(GIFTPATH).mkdir();

class Utils {

	static restrict(x: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, x));
	}
	
	static hash(s: string): number {
		let hash = 0, i, chr;
		if (s.length === 0) return hash;
		for (i = 0; i < s.length; i++) {
			chr = s.charCodeAt(i);
			hash = ((hash << 5) - hash) + chr;
			hash |= 0;
		}
		return hash;
	}

	static image(style: string) {
		return `<img style="${style}"/>`;
	}
	
	static itemStyle(name: string) {
		const num = Dex.items.get(name).spritenum || 0;
		let top = Math.floor(num / 16) * 24;
		let left = (num % 16) * 24;
		return `background:transparent url(${ITEMSHEET}?g8) no-repeat scroll -${left}px -${top}px; height: 24px; width: 24px;`
	}
	
	static iconStyle(name: string) {
		const pokemon = Dex.species.get(name);
		const num = Pet.iconIndex[pokemon.id] || pokemon.num;
		if (num <= 0) {
			// return `background:transparent url(${POKESHEET}) no-repeat scroll -0px 4px;height: 32px;width: 40px;`
			return `height: 32px; width: 40px;`
		}
		const top = Math.floor(num / 12) * 30;
		const left = (num % 12) * 40;
		return `background: transparent url(${POKESHEET}?v5) no-repeat scroll -${left}px -${top}px; height: 32px; width: 40px;`;
	}
	
	static button(message: string, desc: string, style: string = '', highlight: boolean = false) {
		const HLStyle = highlight ? 'border: double;' : '';
		return `<button style="${style} ${HLStyle}" class="button" name="send" value="${message}">${desc}</button>`
	}
	
	static boolButtons(yesMessage: string, noMessage: string) {
		return this.button(yesMessage, '确认') + this.button(noMessage, '取消');
	}

	static parsePosition(target: string): petPosition | undefined {
		if (!target) return;
		const targets = target.split(',').map(x => x.trim());
		if (targets.length !== 2 || (targets[0] !== 'bag' && targets[0] !== 'box')) return;
		const index = parseInt(targets[1]);
		if (index === NaN || index < 0 || index > (targets[0] === 'bag' ? 5 : 29)) return;
		return {'type': targets[0], 'index': index};
	}

	static parseStatPosition(target: string): statPosition | undefined {
		if (!target) return;
		const targets = target.split(',').map(x => x.trim());
		if (targets.length !== 2 || (targets[0] !== 'ivs' && targets[0] !== 'evs')) return;
		const index = targets[1];
		if (index !== 'hp' && index !== 'atk' && index !== 'def' && index !== 'spa' && index !== 'spd' && index !== 'spe') return;
		return {'type': targets[0], 'index': index};
	}

}

class Pet {

	static iconIndex: {[speciesid: string]: number} = PokemonIconIndexes;

	static learnSets: {[speciesid: string]: {[moveid: string]: number}} = PetModeLearnSets;

	static defaultWildMons = [
		'Caterpie', 'Weedle', 'Ledyba', 'Spinarak', 'Wurmple', 'Kricketot', 'Sewaddle', 'Venipede',
		'Scatterbug', 'Grubbin', 'Blipbug', 'Poochyena', 'Shinx', 'Lillipup', 'Purrloin', 'Nickit',
		'Pidgey', 'Hoothoot', 'Taillow', 'Starly', 'Pidove', 'Fletchling', 'Pikipek', 'Rookidee',
		'Rattata', 'Sentret', 'Zigzagoon', 'Bidoof', 'Patrat', 'Bunnelby', 'Yungoos', 'Skwovet',
	];
	
	static initMons = [
		'Bulbasaur', 'Chikorita', 'Treecko', 'Turtwig', 'Snivy', 'Chespin', 'Rowlet', 'Grookey',
		'Charmander', 'Cyndaquil', 'Torchic', 'Chimchar', 'Tepig', 'Fennekin', 'Litten', 'Scorbunny',
		'Squirtle', 'Totodile', 'Mudkip', 'Piplup', 'Oshawott', 'Froakie', 'Popplio', 'Sobble',
	];

	static typeIcons: {[speciesname: string]: string} = {};
	
	static moveIcons: {[movename: string]: string} = {};

	static initButtons = [0, 1, 2].map(x => this.initMons.slice(x * 8, x * 8 + 8).map(
		x => Utils.button(`/pet init set ${x}`, '', Utils.iconStyle(x))
	).join('')).join('<br/>');

	static spriteId(speciesid: string) {
		speciesid = toID(speciesid);
		let species = Dex.species.get(speciesid);
		const baseid = toID(species.baseSpecies);
		speciesid = speciesid.substring(baseid.length);
		return baseid + (speciesid ? '-' + speciesid : '')
	}

	static validMoves(speciesid: string, level: number): string[] {
		if (!this.learnSets[speciesid]) return [];
		return Object.keys(this.learnSets[speciesid]).filter(moveid => {
			return this.learnSets[speciesid][moveid] <= level;
		});
	}
	
	static sampleMoves(species: string, level: number): string[] {
		let validMoves = this.validMoves(species, level);
		prng.shuffle(validMoves);
		return validMoves.slice(0, 4); 
	}

	static randomIvs(): StatsTable {
		let intArray = [...new Array(32).keys()];
		return {hp: prng.sample(intArray), atk: prng.sample(intArray), def: prng.sample(intArray),
			spa: prng.sample(intArray), spd: prng.sample(intArray), spe: prng.sample(intArray)};
	}

	static gen(speciesid: string, level: number, fullivs: boolean = false, happy: number = 0, shiny: number = 1 / 512): string {
		level = Utils.restrict(level, 1, 100);
		const species = Dex.species.get(speciesid);
		if (species.num <= 0) return '';
		const set: PokemonSet = {
			name: species.name,
			species: species.name,
			item: "",
			ability: species.abilities["1"] ? prng.sample([species.abilities["0"], species.abilities["1"]]) : species.abilities["0"],
			moves: this.sampleMoves(species.id, level),
			nature: prng.sample(Dex.natures.all()).name,
			gender: prng.randomChance(Math.floor(species.genderRatio.M * 1000), 1000) ? 'M' : 'F',
			evs: {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0},
			ivs: fullivs ? {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31} : this.randomIvs(),
			level: level,
			happiness: happy,
			shiny: prng.randomChance(shiny * 1000, 1000),
		};
		return Teams.pack([set]);
	}
	
	static wild(roomid: string, maxLevel: number, legend: boolean = false): string {
		if (legend && PetBattle.legends[roomid]) {
			const features = PetBattle.legends[roomid].split('|');
			return this.gen(features[0], parseInt(features[1]), true, 0, parseInt(features[2]));
		}
		if (PetBattle.roomConfig[roomid]) {
			const roomConfig: {'lawn': string[], 'minlevel': number, 'maxlevel': number} = PetBattle.roomConfig[roomid];
			return this.gen(
				prng.sample(roomConfig['lawn'] || this.defaultWildMons),
				prng.sample([...new Array(11).keys()].map(x => {
					return x + Utils.restrict(maxLevel, roomConfig['minlevel'], roomConfig['maxlevel']) - 5;
				}))
			);
		}	
		return this.gen(
			prng.sample(this.defaultWildMons),
			prng.sample([...new Array(11).keys()].map(x => x + Utils.restrict(maxLevel, 5, 20) - 5))
		);
	}

	static parseSet(packedSet: string): PokemonSet | undefined {
		const floatLevel = parseFloat(packedSet.split('|')[10]) || 100;
		const sets = Teams.unpack(packedSet);
		if (!sets) return;
		const set = sets[0];
		set.level = floatLevel;
		if (!set.species) set.species = set.name;
		const species = Dex.species.get(set.species);
		if (!set.ability) set.ability = species.abilities["0"];
		if (!set.evs) set.evs = {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0};
		if (!set.ivs) set.ivs = {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31};
		if (!set.item) set.item = '';
		if (!set.shiny) set.shiny = false;
		if (set.happiness === undefined) set.happiness = 255;
		return set;
	}

	static validEvos(set: PokemonSet): (string)[][] {
		return Dex.species.get(set.species).evos.map(x => {
			const species = Dex.species.get(x);
			if (species.evoCondition) {
				const hours = new Date().getHours();
				switch (species.evoCondition) {
					case "at night":
						if (hours > 5 && hours < 18) return [];
						break;
					case "during the day":
						if (hours < 6 || hours > 17) return [];
						break;
				}
			}
			if (species.evoType) {
				switch (species.evoType) {
					case 'useItem':
						return set.item === species.evoItem ? [x, set.item] : [];
					case 'levelMove':
						return set.moves.indexOf(species.evoMove || '') >= 0 ? [x, ''] : [];
					case 'levelFriendship':
						return (set.happiness !== undefined ? set.happiness : 255) > 220 ? [x, ''] : [];
					case 'levelHold':
						return set.item === species.evoItem ? [x, set.item] : [];
					case 'trade':
						return [];
					default:
						return set.level > 35 ? [x, ''] : [];
				}
			}
			return set.level >= (species.evoLevel || 100) ? [x, ''] : [];
		}).filter(x => x.length === 2);	
	}

}
Dex.moves.all().forEach(move => {
	Pet.moveIcons[move.name] = `background: url(${TYPEICONS}/${move.type}.png) no-repeat 5%, ` +
		`url(${CATICONS}/${move.category}.png) no-repeat 95%;`;
})
Dex.species.all().forEach(species => {
	Pet.typeIcons[species.name] = Utils.image(`background: url(${TYPEICONS}/${species.types[0]}.png); width: 32px; height: 14px`) +
		(species.types[1] ? Utils.image(`background: url(${TYPEICONS}/${species.types[1]}.png); width: 32px; height: 14px`) : '');
})

class PetBattle {

	static legends: {[roomid: string]: string} = {};

	static roomConfig: {[roomid: string]: {'lawn': string[], 'minlevel': number, 'maxlevel': number}} = PetModeRoomConfig;

	static balls: {[ballname: string]: number} = {'Poke Ball': 1, 'Great Ball': 2, 'Ultra Ball': 4, 'Master Ball': Infinity};

	static inBattle(userid: string): string | undefined {
		const battleWithBot = (roomid: string) => {
			const battle = Rooms.get(roomid)?.battle;
			return battle && (battle.p1.id === BOTID || battle.p2.id === BOTID) &&
				(battle.p1.id === userid || battle.p2.id === userid) && !battle.ended;
		}
		const user = Users.get(userid);
		if (!user) return undefined;
		return [...user.inRooms].filter(x => x.indexOf('petmode') >= 0 && battleWithBot(x))[0];
	}

	static catch(T: number, L: number, userid: string, ball: string, species: string, roomOfLegend: string): boolean {
		let R = 1;
		if (roomOfLegend) {
			if (!this.legends[roomOfLegend]) return false;
			R = 10;
		}
		const U = 1;
		const B = this.balls[ball] || 1;
		const S = Math.pow(Dex.species.get(species).bst, 2) / 1e5 + 1;
		return prng.randomChance(Math.pow((20 + Math.sqrt(T)) / (20 + L), 2) / S * B * U / R * 1000, 1000);
	}

}

class Shop {

	static shopConfig: {[goodtype: string]: {[goodname: string]: number}} = PetModeShopConfig;
	
	static types: {[goodtype: string]: string} = {
		'ball': '精灵球', 'draw': '进化道具', 'berry': '树果', 'battle': '对战道具', 'special': '专用对战道具'
	};
	
	static goodButtons: {[goodtype: string]: string} = {
		'ball': Object.keys(PetModeShopConfig['ball']).map(goodname => {
			return Utils.button(`/pet shop show ball=>${goodname}`, '', Utils.itemStyle(goodname));
		}).join(''),
		'draw': Object.keys(PetModeShopConfig['draw']).map(goodname => {
			return Utils.button(`/pet shop show ball=>${goodname}`, '', Utils.itemStyle(goodname));
		}).join(''),
		'berry': Object.keys(PetModeShopConfig['berry']).map(goodname => {
			return Utils.button(`/pet shop show ball=>${goodname}`, '', Utils.itemStyle(goodname));
		}).join(''),
		'battle': Object.keys(PetModeShopConfig['battle']).map(goodname => {
			return Utils.button(`/pet shop show ball=>${goodname}`, '', Utils.itemStyle(goodname));
		}).join(''),
		'special': Object.keys(PetModeShopConfig['special']).map(goodname => {
			return Utils.button(`/pet shop show ball=>${goodname}`, '', Utils.itemStyle(goodname));
		}).join(''),
	};

}

class PetUser {

	private id: string;
	private path: string;

	chatRoomId: string | undefined;
	battleRoomId: string | undefined;
	battleInfo: string | undefined;

	operation: string | undefined;
	property: userProperty | undefined;
	onPosition: petPosition | undefined;
	onChangeMoves: {'position': petPosition, 'selected': string[], 'valid': string[]} | undefined;

	constructor(userid: string, dir: string = USERPATH) {
		this.id = userid;
		this.path = `${dir}/${this.id}.json`;
		this.load();
	}

	load() {
		const userSaveData = FS(this.path).readIfExistsSync();
		if (userSaveData) this.property = JSON.parse(userSaveData);
	}

	save() {
		if (this.property) FS(this.path).safeWriteSync(JSON.stringify(this.property));
	}

	init() {
		this.property = {
			'bag': new Array(6).fill(''),
			'box': new Array(30).fill(''),
			'items': {'Poke Ball': 5},
			'badges': [],
			'time': {'ball': 0, 'draw': 0, 'search': 0}
		}
	}
	
	destroy() {
		FS(this.path).unlinkIfExistsSync();
	}
	
	editProperty(propertyString: string): boolean {
		const cachedProperty = JSON.parse(JSON.stringify(this.property));
		try {
			const parsed = JSON.parse(propertyString);
			this.init();
			let items: {[itemName: string]: number} = {};
			for (let item in parsed['items']) {
				const parsedNum = parseInt(parsed['items'][item]);
				if (parsedNum !== NaN) items[item] = parsedNum;
			}
			if (!this.property) throw Error();
			Object.assign(this.property['items'], items);
			Object.assign(this.property['bag'], parsed['bag'].map((x: string) => Teams.pack(Teams.unpack(x))));
			if (parsed['box']) Object.assign(this.property['box'], parsed['box'].map((x: string) => Teams.pack(Teams.unpack(x))));
			if (this.property['bag'].filter(x => x).length === 0) throw Error();
		} catch (err) {
			this.property = cachedProperty;
			return false;
		}
		return true;
	}

	addPet(pet: string): boolean {
		if (!this.property || !pet) return false;
		const bagIndex = this.property.bag.indexOf('');
		if (bagIndex >= 0) {
			this.property.bag[bagIndex] = pet;
			return true;
		}
		const boxIndex = this.property.box.indexOf('');
		if (boxIndex >= 0) {
			this.property.box[boxIndex] = pet;
			return true;
		}
		return false;
	}

	removePet(position: petPosition, item: string = ''): boolean {
		if (!this.property) return false;
		if (position['type'] === 'bag' && this.property['bag'].filter(x => x).length <= 1) return false;
		if (item) this.addItem(item, 1);
		this.property[position['type']][position['index']] = '';
		return true;
	}

	checkPet(position: petPosition | undefined): PokemonSet | undefined {
		if ((this.onPosition = position) && this.property) {
			return Pet.parseSet(this.property[position['type']][position['index']]);
		}
	}

	movePet(pos1: petPosition, pos2: petPosition): boolean{
		if (!this.property) return false;
		const set1 = this.property[pos1['type']][pos1['index']];
		const set2 = this.property[pos2['type']][pos2['index']];
		const bagSize = this.property['bag'].filter(x => x).length;
		if (bagSize <= 1 && (
			(pos1['type'] === 'bag' && pos2['type'] === 'box' && !set2) ||
			(pos2['type'] === 'bag' && pos1['type'] === 'box' && !set1)
		)) return false;
		this.property[pos1['type']][pos1['index']] = set2;
		this.property[pos2['type']][pos2['index']] = set1;
		return true;
	}

	namePet(name: string): boolean {
		if (!this.property || !this.onPosition) return false;
		let pet = this.property[this.onPosition['type']][this.onPosition['index']];
		if (!pet) return false;
		const features = pet.split('|');
		if (!features[1]) features[1] = features[0];
		features[0] = name || features[1];
		pet = features.join('|');
		this.property[this.onPosition['type']][this.onPosition['index']] = pet;
		return true;
	}

	checkEvo(position: petPosition): string[][] {
		if (!this.property) return [];
		const set = Pet.parseSet(this.property[position['type']][position['index']]);
		if (!set) return [];
		return Pet.validEvos(set);
	}

	evo(position: petPosition, targetSpecies: string, item: boolean): boolean {
		if (!this.property) return false;
		const set = Pet.parseSet(this.property[position['type']][position['index']]);
		if (!set) return false;
		if (item) set.item = '';
		if (set.species === set.name) set.name = targetSpecies;
		const preAbilities = Dex.species.get(set.species).abilities;
		const postAbilities = Dex.species.get(targetSpecies).abilities;
		switch (set.ability) {
			case preAbilities['1']:
				if (postAbilities['1']) { set.ability = postAbilities['1']; break; }
			case preAbilities['H']:
				if (postAbilities['H']) { set.ability = postAbilities['H']; break; }
			case preAbilities['S']:
				if (postAbilities['S']) { set.ability = postAbilities['S']; break; }
			default:
				set.ability = postAbilities['0'];
		}
		set.species = targetSpecies;
		this.property[position['type']][position['index']] = Teams.pack([set]);
		return true;
	}

	addItem(itemName: string, num: number): boolean {
		if (!this.property) return false;
		if (!(itemName in this.property['items'])) this.property['items'][itemName] = 0;
		this.property['items'][itemName] += num;
		return true;
	}

	removeItem(itemName: string, num: number): boolean {
		if (!this.property) return false;
		if (itemName && itemName in this.property['items']) {
			this.property['items'][itemName] -= 1;
			if (this.property['items'][itemName] === 0) {
				delete this.property['items'][itemName];
			}
			return true;
		}
		return false;
	}

	setItem(position: petPosition, itemName: string): boolean {
		if (!this.property) return false;
		const set = Pet.parseSet(this.property[position['type']][position['index']]);
		if (!set) return false;

		if (set.item) {
			if (this.addItem(set.item, 1)) set.item = '';
		} else {
			if (this.removeItem(itemName, 1)) set.item = itemName;
		}
		this.property[position['type']][position['index']] = Teams.pack([set]);
		return true;
	}

	changeMoves(position: petPosition): boolean {
		if (!this.property) return false;
		const set = Pet.parseSet(this.property[position['type']][position['index']]);
		if (!set) return false;
		if (!this.onChangeMoves) return false;
		set.moves = this.onChangeMoves['selected'];
		this.property[position['type']][position['index']] = Teams.pack([set]);
		return true;
	}

	resetStat(position: statPosition): boolean {
		if (!this.property || !this.onPosition) return false;
		const set = Pet.parseSet(this.property[this.onPosition['type']][this.onPosition['index']]);
		if (!set) return false;
		set[position['type']][position['index']] = 0;
		this.property[this.onPosition['type']][this.onPosition['index']] = Teams.pack([set]);
		return true;
	}

	maxLevel(): number {
		if (!this.property) return 0;
		return Math.max(...this.property['bag'].filter(x => x).map(x => parseInt(x.split('|')[10]) || 100));
	}
	
	balls(): string[] {
		if (!this.property) return [];
		return Object.keys(this.property['items']).filter(itemname => !!PetBattle.balls[itemname]);
	}

	addExperience(foespecies: string, foelevel: number): boolean {
		if (!this.property) return false;
		let levelUp = false;
		for (let index in this.property['bag']) {
			const ownPoke = this.property['bag'][index];
			if (ownPoke) {
				let features = ownPoke.split('|');
				let level = parseFloat(features[10]) || 100;
				// 经验 = foeLevel * foeBst
				// level + 1 所需经验 = level * bst * 2
				const foebst = eval(Object.values(Dex.species.get(foespecies).baseStats).join('+'));
				let experience = foelevel * foebst;
				const bst = eval(Object.values(Dex.species.get(features[1] || features[0]).baseStats).join('+'));
				const needExp = (l: number) => Math.floor(l) * bst * 2;
				let need = needExp(level);
				let newLevel = level + experience / need;
				while (Math.floor(newLevel) > Math.floor(level)) {
					level += 1;
					levelUp = true;
					need = needExp(level);
					newLevel = level + experience / need;
					experience = experience - needExp(level);
				}
				features[10] = newLevel >= 100 ? '' : newLevel.toString();
				const evs = (features[6] || ',,,,,').split(',').map((x: string) => parseInt(x) || 0);
				const f = Math.abs(Utils.hash(foespecies)) % 6;
				evs[f] = evs[f] + Math.max(Math.min(10, 252 - evs[f], 510 - eval(evs.join('+'))), 0);
				features[6] = evs.join(',');
				features[11] = Math.min((features[11] ? parseInt(features[11]) : 255) + 10, 255).toString();
				this.property['bag'][index] = features.join('|');
			}
		}
		return levelUp;
	}

	merge(targetUser: PetUser): {'bag': string[], 'items': {[itemname: string]: number}} {
		let added: {'bag': string[], 'items': {[itemname: string]: number}} = {'bag': [], 'items': {}};
		if (!targetUser.property) return added;
		let pokes = (targetUser.property['bag'] || []).filter(x => x);
		targetUser.property['bag'] = [];
		for (let i = 0; i < pokes.length; i++) {
			let poke = pokes[i];
			if (this.addPet(poke)) {
				let features = poke.split('|');
				added['bag'].push(features[1] || features[0]);
			} else {
				targetUser.property['bag'] = pokes.splice(i);
				break;
			}
		}
		let items = targetUser.property['items'];
		for (let itemname in items) {
			this.addItem(itemname, items[itemname]);
			added['items'][itemname] = items[itemname];
		}
		targetUser.property['items'] = {};
		return added;
	}
}

const petUsers: {[userid: string]: PetUser} = {};

function getUser(userid: string): PetUser {
	return petUsers[userid] || (petUsers[userid] = new PetUser(userid));
}

export function dropUser(userid: string) {
	delete petUsers[userid];
}

export const commands: Chat.ChatCommands = {

	name(target) {
		this.parse(`/pet box name ${target}`);
	},

	'gen': 'add',
	add(target) {
		this.parse(`/pet lawn add ${target}`);
	},


	'rm': 'remove',
	remove(target) {
		this.parse(`/pet lawn remove ${target}`);
	},

	'petmode': 'pet',
	pet: {

		init: {

			'': 'show',
			show(target, room, user) {
				if (!user.registered) return this.popupReply("请先注册账号!");
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (petUser.property) return this.parse('/pet init guide');
				this.parse('/pet init clear');
				user.sendTo(room.roomid, `|uhtml|pet-init-show|欢迎使用宠物系统!请选择您最初的伙伴：<br/>${Pet.initButtons}`);
			},

			set(target, room, user) {
				if (!user.registered) return this.popupReply("请先注册账号!");
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (petUser.property) return this.parse('/pet init guide');
				this.parse('/pet init clear');
				user.sendTo(room.roomid, `|uhtml|pet-init-show|确认选择<img style="${Utils.iconStyle(target)}"/>作为您最初的伙伴?${
					Utils.boolButtons(`/pet init confirm ${target}`, '/pet init show')
				}`);
			},

			confirm(target, room, user) {
				if (!user.registered) return this.popupReply("请先注册账号!");
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (petUser.property) return this.parse('/pet init guide');
				if (Pet.initMons.indexOf(target) < 0) return this.popupReply(`${target}不是合法初始的宝可梦`)

				petUser.init();
				petUser.addPet(Pet.gen(target, 5, true, 70));
				petUser.save();

				this.parse('/pet init guide');
			},

			guide(target, room, user) {
				if (!user.registered) return this.popupReply("请先注册账号!");
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				this.parse('/pet init clear');
				user.sendTo(room.roomid, `|uhtml|pet-init-show|您已领取最初的伙伴! 快进入 ${
					Utils.button('/pet box show', '盒子')
				} 查看吧!`);
			},

			clear(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				user.sendTo(room.roomid, `|uhtmlchange|pet-init-show|`);
			}

		},


		name(target) {
			this.parse(`/pet box name ${target}`);
		},

		box: {

			'': 'show',
			show(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				this.parse('/pet init clear');
				this.parse('/pet shop clear');
				const st = (x: string) => `<strong>${x}</strong>`;

				petUser.load();
				let pokeDiv = ``;
				const set = petUser.checkPet(Utils.parsePosition(target));
				if (set) {
					let setTitle = '<br/>';
					if (petUser.operation === 'ex') {
						setTitle = st('请选择位置');
					} else if (petUser.operation === 'drop' + target) {
						setTitle = st(`确认放生 ${set.name} ? `) + Utils.boolButtons(
							`/pet box drop ${target}!`,
							`/pet box drop ${target}`
						);
					} else if (petUser.operation?.indexOf('resetstat') === 0) {
						const statOperation = petUser.operation.slice(9);
						const statPosition = statOperation.split(',')
						if (statPosition.length === 2) {
							const statType = statPosition[0] === 'ivs' ? '个体值' : 'evs' ? '努力值' : undefined;
							const statIndex = ['HP', '攻击', '防御', '特攻', '特防', '速度'][
								['hp', 'atk', 'def', 'spa', 'spd', 'spe'].indexOf(statPosition[1])
							]
							if (statType && statIndex) {
								setTitle = st(`确认清空 ${set.name} 的${statIndex}${statType}? `) + Utils.boolButtons(
									`/pet box resetstat ${statOperation}!`,
									`/pet box reset ${target}`
								);
							}
						}
					} else if (petUser.operation === 'evo') {
						setTitle = st('请选择进化型: ') + Pet.validEvos(set).map(x => {
							return Utils.button(`/pet box evo ${target}=>${x[0]}`, '&emsp;', Utils.iconStyle(x[0]));
						}).join('') + ' ' + Utils.button(`/pet box evo ${target}`, '取消');
					} else if (petUser.operation?.indexOf('evo') === 0) {
						setTitle = st(`确认进化 ${set.name} ? `) + Utils.boolButtons(
							`/pet box evo ${target}=>${petUser.operation?.slice(3)}`,
							`/pet box evo ${target}`
						);
					}
					const setButtons = [
						Utils.button(`/pet box nameguide ${target}`, '昵称'),
						Utils.button(`/pet box onex ${target}`, '移动'),
						Utils.button(`/pet box link ${target}`, '交换'),
						Utils.button(`/pet box evo ${target}`, '进化'),
						Utils.button(`/pet box moves ${target}`, '招式'),
						Utils.button(`/pet box drop ${target}`, '放生'),
						Utils.button(`/pet box reset`, '返回')
					]

					const bst = Dex.species.get(set.species).baseStats;
					const th = (x: string | number) => `<th style="text-align: center; padding: 0">${x}</th>`;
					const td = (x: string | number) => `<td style="text-align: center; padding: 0">${x}</td>`;
					const statsTable = `<table style="border-spacing: 0px;"><tr>${[
						th('') + ['HP', '攻击', '防御', '特攻', '特防', '速度'].map(x => th(x)).join(''),
						th('种族&ensp;') + Object.values(bst).map(x => td(x)).join(''),
						th('个体&ensp;') + Object.keys(set.ivs).map((x, i) => {
							return td(Utils.button(`/pet box resetstat ivs,${x}`, Object.values(set.ivs)[i].toString()));
						}).join(''),
						th('努力&ensp;') + Object.keys(set.evs).map((x, i) => {
							return td(Utils.button(`/pet box resetstat evs,${x}`, Object.values(set.evs)[i].toString()));
						}).join('')
					].join('</tr><tr>')}</tr></table>`;
					const lines = [
						`${set.name}&emsp;${st('种类')} ${set.species}&emsp;${Pet.typeIcons[set.species]}`,
						`${st('性别')} ${{'M': '♂', 'F': '♀'}[set.gender] || '∅'}&emsp;${st('亲密度')} ${set.happiness}`,
						`${st('等级')} ${Math.floor(set.level)} (${Math.floor((set.level - Math.floor(set.level)) * 100)}%)&emsp;` + 
						`${st('道具')} ${set.item ? Utils.button(`/pet box item ${target}`, '', Utils.itemStyle(set.item)) : '无'}`,
						`${st('性格')} ${set.nature}&emsp;${st('特性')} ${set.ability}`
					]
					const spriteURL = `${set.shiny ? POKESPRITESSHINY : POKESPRITES}/${Pet.spriteId(set.species)}.gif`;
					const sprite = `background: transparent url(${spriteURL}) no-repeat 90% 10% relative;`
					pokeDiv = `<div style="width: 350px; ` +
						`position: relative; display: inline-block;"><div style="line-height: 35px">${setTitle}</div>` +
						`<div style=" display: inline-block; width: 50px; line-height: 32px; vertical-align: top;` +
						`">${setButtons.join('<br/>')}</div>` +
						`<div style="${sprite} display: inline-block; line-height: 28px; width: 300px;` +
						`">${lines.map(x => `${x}`).join('<br/>')}<br/>${statsTable}</div>`;
				}

				const boxTitle = `${st('用户ID')} ${user.id}&emsp;${st('徽章数')} ${petUser.property['badges'].length}`;
				const petButton = (species: string, pos: string) => {
					const style = Utils.iconStyle(species);
					if (petUser.operation === 'ex') return Utils.button(`/pet box ex ${target}<=>${pos}`, '', style);
					return Utils.button(`/pet box show ${pos}`, '', style, target === pos.split(' ').join(''));
				};
				const bagMons = petUser.property['bag'].map((x, i) =>
					petButton(x.split('|')[1] || x.split('|')[0], `bag,${i}`)).join('') + '<br/>';
				const boxMons = petUser.property['box'].map((x, i) =>
					petButton(x.split('|')[1] || x.split('|')[0], `box,${i}`) + (i % 6 == 5 ? '<br/>' : '')).join('');
				let items = ``;
				const itemButton = (item: string) => Utils.button(
					petUser.onPosition ? `/pet box item ${target}=>${item}` : '', '', Utils.itemStyle(item)
				);
				const itemNum = (x: number) => x > 0 ? x : '∞';
				for (let itemName in petUser.property['items']) {
					items += `${itemButton(itemName)}x${itemNum(petUser.property['items'][itemName])}<br/>`;
				}
				const shopButton = Utils.button('/pet shop', '商店');
				let boxDiv = `<div style="width: 310px; vertical-align: top; display: inline-block;">` +
					`<div style="width: 250px; vertical-align: top; display: inline-block">` +
					`<div style="line-height: 35px">${boxTitle}</div>` +
					`<div>${st(`背包`)}<br/>${bagMons}${st(`盒子`)}<br/>${boxMons}</div></div>` +
					`<div style="width: 60px; vertical-align: top; display: inline-block;">` +
					`<div style="line-height: 35px">${shopButton}</div><div>${st(`道具`)}</div>` +
					`<div style="height: 210px; overflow: auto;">${items}</div></div></div>`;

				this.parse('/pet box clear');
				user.sendTo(room.roomid, `|uhtml|pet-box-show|<div style="height: 300">${boxDiv}${pokeDiv}</div>`);
			},

			onex(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				petUser.operation = 'ex';
				this.parse(`/pet box show ${target}`);
			},

			ex(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				petUser.operation = undefined;
				const targets = target.split('<=>').map(x => x.trim());
				if (targets.length !== 2) return this.popupReply(`Usage: /pet box ex [bag|box],position1<=>[bag|box],position2`);
				const pos1 = Utils.parsePosition(targets[0]);
				const pos2 = Utils.parsePosition(targets[1]);
				if (!pos1 || !pos2) return this.popupReply(`位置不存在!`);
				petUser.load();
				if (petUser.movePet(pos1, pos2)) {
					petUser.save();
					this.parse(`/pet box show ${targets[1]}`);
				} else {
					this.popupReply(`背包不能为空!`);
				}
			},

			evo(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				// [进化]: petUser.operation = evo, /pet box show = 希望的进化型(/pet box evo {target}=>{goal})
				// [选择进化型]: petUser.operation = evo{goal},
				//              /pet box show = 确认(/pet box evo {target}=>{goal}) | 取消(/pet box evo {target})
				// [确认]: petUser.operation = undefined, /pet box show = 进化(/pet box evo {target})
				const targets = target.split('=>').map(x => x.trim());
				target = targets[0];
				const goal = targets[1];
				const position = Utils.parsePosition(target);
				if (!position) return this.popupReply('位置不存在!');
				const availableEvos = petUser.checkEvo(position);
				if (availableEvos.length === 0) {
					return this.popupReply('不满足进化条件!');
				}
				if (petUser.operation?.indexOf('evo') === 0) {
					if (targets.length !== 2) {
						petUser.operation = undefined;
					} else {
						const index = availableEvos.map(x => x[0]).indexOf(goal);
						if (index < 0) return this.popupReply('进化型不合法!');
						if (petUser.operation.slice(3) === goal) {
							petUser.load();
							if (petUser.evo(position, goal, !!availableEvos[index][1])) {
								this.popupReply('进化成功!');
								petUser.operation = undefined;
								petUser.save();
							} else {
								this.popupReply('进化失败!');
							}
						} else {
							petUser.operation = 'evo' + goal;
						}
					}
				} else {
					petUser.operation = 'evo';
				}
				this.parse(`/pet box show ${target}`);
			},
	
			item(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				const targets = target.split('=>').map(x => x.trim());
				target = targets[0];
				const position = Utils.parsePosition(target);
				if (!position) return this.popupReply('位置不存在!');

				petUser.load();
				if (petUser.setItem(position, targets[1])) petUser.save();

				this.parse(`/pet box show ${target}`);
			},
	
			moves(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				user.sendTo(room.roomid, `|uhtmlchange|pet-box-show|`);
				const targets = target.split('=>').map(x => x.trim());
				target = targets[0];
				const position = Utils.parsePosition(target);
				if (!position) return this.popupReply('位置不存在!');
				petUser.load();
				const set = petUser.checkPet(position);
				if (!set) return this.popupReply('位置是空的!');
				if (!(petUser.onChangeMoves)) {
					petUser.onChangeMoves = {
						'position': position,
						'selected': set.moves,
						'valid': Pet.validMoves(toID(set.species), set.level).map(x => Dex.moves.get(x).name)
					};
				}
				const div = (x: string) =>
					`<div style="display: inline-block; position: relative; width: 200px; padding: 5px; border: ridge;` +
					` height: 150px; overflow: auto; vertical-align: top;">${x}</div>`;
				const valid = petUser.onChangeMoves['valid'].map(move =>
					Utils.button(`/pet box addmove ${target}=>${move}`, move, `${Pet.moveIcons[move]} width: 180px;`)
				).join('<br/>');
				const selected = petUser.onChangeMoves['selected'].map(move =>
					Utils.button(`/pet box addmove ${target}=>${move}`, move, `${Pet.moveIcons[move]} width: 180px;`)
				).join('<br/>');
				const buttons = Utils.boolButtons(`/pet box setmoves ${target}!`, `/pet box setmoves ${target}`);
				user.sendTo(room.roomid, `|uhtmlchange|pet-moves-show|`);
				user.sendTo(room.roomid, `|uhtml|pet-moves-show|<strong>请选择招式:</strong><br/>` +
					`${div(valid)}${div(`${selected}<br/>${buttons}`)}`);
			},

			addmove(target, room, user) {
				const targets = target.split('=>');
				if (targets.length !== 2) return this.popupReply('请先指定需要更改招式的宝可梦');
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				if (!petUser.onChangeMoves) return this.popupReply('请先指定需要更改招式的宝可梦');
				const selectedIndex = petUser.onChangeMoves['selected'].indexOf(targets[1]);
				if (selectedIndex >= 0) {
					petUser.onChangeMoves['selected'].splice(selectedIndex, 1);
					return this.parse(`/pet box moves ${target}`);
				}
				const validIndex = petUser.onChangeMoves['valid'].indexOf(targets[1]);
				if (validIndex >= 0 && petUser.onChangeMoves['selected'].length < 4) {
					petUser.onChangeMoves['selected'].push(targets[1]);
					return this.parse(`/pet box moves ${target}`);
				}
			},

			setmoves(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				const targets = target.split('!').map(x => x.trim());
				petUser.load();
				target = targets[0];
				if (targets.length === 2 && petUser.onChangeMoves && petUser.onChangeMoves['selected'].length > 0) {
					const position = Utils.parsePosition(target);
					if (!position) return this.popupReply('位置不存在!');
					if (petUser.changeMoves(position)) petUser.save();
				}
				this.parse(`/pet box show ${target}`);
			},

			drop(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				const targets = target.split('!').map(x => x.trim());
				target = targets[0];
				petUser.load();
				const position = Utils.parsePosition(target);
				if (!position) return this.popupReply('位置不存在!');
				const set = petUser.checkPet(position);
				if (!set) return this.popupReply('位置是空的!');
				if (petUser.operation === 'drop' + target) {
					petUser.operation = undefined;
					if (targets.length === 2) {
						if (petUser.removePet(position, set.item)) {
							petUser.save();
						} else {
							this.popupReply('背包不能为空!');
						}
					}
				} else {
					petUser.operation = 'drop' + target;
				}
				this.parse(`/pet box show ${target}`);
			},

			nameguide(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				if (petUser.onPosition) this.popupReply("请在房间里输入: /name 昵称")
			},

			name(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				petUser.load();
				if (petUser.namePet(target)) {
					petUser.save();
					this.popupReply('修改成功!');
					this.parse(`/pet box show ${petUser.onPosition ? Object.values(petUser.onPosition).join(',') : ''}`);					
				}
			},

			resetstat(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				let confirm = false;
				if (target.indexOf('!') >= 0) {
					confirm = true;
					target = target.split('!')[0];
				}
				const statPosition = Utils.parseStatPosition(target);
				if (!statPosition) return this.popupReply("Usage: /pet box resetstat [ivs|evs],[hp|atk|def|spa|spd|spe]!");
				if (confirm) {
					petUser.load();
					if (petUser.resetStat(statPosition)) {
						this.popupReply("修改成功!");
						petUser.operation = undefined;
						petUser.save();
					}
				} else {
					petUser.operation = `resetstat${statPosition['type']},${statPosition['index']}`
				}
				this.parse(`/pet box show ${petUser.onPosition ? Object.values(petUser.onPosition).join(',') : ''}`);	
			},

			reset(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				petUser.operation = undefined;
				this.parse(`/pet box show ${target}`);
			},

			clear(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				petUser.onChangeMoves = undefined;
				user.sendTo(room.roomid, `|uhtmlchange|pet-moves-show|`);
				user.sendTo(room.roomid, `|uhtmlchange|pet-box-show|`);
			},

		},

		'gen': 'add',
		add(target) {
			this.parse(`/pet lawn add ${target}`);
		},

		'rm': 'remove',
		remove(target) {
			this.parse(`/pet lawn remove ${target}`);
		},

		lawn: {

			'': 'search',
			search(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				const bot = Users.get(BOTID);
				if (!bot || PetBattle.inBattle(user.id)) return this.popupReply("没有发现野生的宝可梦哦");
				const wantLegend = target.indexOf('!') >= 0 && !!PetBattle.legends[room.roomid];

				petUser.load();
				if (Date.now() - petUser.property['time']['search'] < LAWNCD) {
					return this.popupReply(`您的宝可梦累了, 请稍后再来!`);
				}
				const wildPokemon = Pet.wild(room.roomid, petUser.maxLevel(), wantLegend);
				if (!wildPokemon) return this.popupReply('没有发现野生的宝可梦哦');
				petUser.property['time']['search'] = Date.now();
				petUser.battleInfo = wildPokemon + (wantLegend ? `<=${room.roomid}` : '');
				petUser.save();

				const battleRoom = Rooms.createBattle({
					format: 'gen8petmode',
					p1: {
						user: user,
						team: 'randomPetMode',
						rating: 0,
						hidden: !wantLegend,
						inviteOnly: false,
					},
					p2: {
						user: bot,
						team: wildPokemon,
						rating: 0,
						hidden: !wantLegend,
						inviteOnly: false,
					},
					p3: undefined,
					p4: undefined,
					rated: 0,
					challengeType: 'unrated',
					delayedStart: false,
				});
				if (wantLegend && battleRoom) {
					room.add(`|html|<div style="text-align: center;"><a href='${
						battleRoom.roomid}'>${user.name} 开始了与 ${PetBattle.legends[room.roomid].split('|')[0]
					} 的战斗!</a></div>`).update();
				}
			},
	
			ball(target, room, user) {
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				if (!room || !room.battle || !petUser.battleInfo) return this.popupReply("请在对战房间里捕捉宝可梦");
				if (PetBattle.inBattle(user.id) !== room.roomid) return this.popupReply("没有可以捕捉的宝可梦!");
				petUser.load();
				const balls = petUser.balls();
				if (balls.length === 0) return this.popupReply(`您还没有可以使用的精灵球哦`);
				user.sendTo(room.roomid, `|uhtmlchange|pet-ball|`);
				if (target) {
					if (!petUser.removeItem(target, 1)) return this.popupReply(`您的背包里没有${target}!`);
					const parsed = petUser.battleInfo.split('<=');
					const features = parsed[0].split('|');
					const roomOfLegend = parsed[1];
					const foeLevel = parseInt(features[10]) || 100;
					const foeSpecies = features[1] || features[0];
					if (PetBattle.catch(room.battle.turn, foeLevel, user.id, target, foeSpecies, roomOfLegend)) {
						if (petUser.addPet(parsed[0])) {
							petUser.battleInfo = undefined;
							this.popupReply(`捕获成功! 快进入盒子查看吧!`);
							this.parse('/forfeit');
							petUser.addExperience(foeSpecies, foeLevel);
							if (roomOfLegend) {
								Rooms.get(roomOfLegend)?.add(`|uhtmlchange|pet-legend|`);
								Rooms.get(roomOfLegend)?.add(
									`|uhtml|pet-legend|<div class='broadcast-green' style="text-align: center;"><strong>${
										user.name
									} 成功捕获了野生的 ${foeSpecies}!</strong></div>`
								).update();
								delete PetBattle.legends[roomOfLegend];
							}
						} else {
							this.popupReply(`您的盒子里没有空位了!`);
							petUser.addItem(target, 1);
						}
					} else {
						if (roomOfLegend && !PetBattle.legends[roomOfLegend]) {
							this.popupReply(`很遗憾, ${roomOfLegend} 房间里的 ${foeSpecies} 已经离开了。`);
							petUser.addItem(target, 1);
						} else {
							this.popupReply(`捕获失败!`);
						}
					}
					petUser.save();
				} else {
					user.sendTo(room.roomid, `|uhtml|pet-ball|${balls.map(item => Utils.button(
						`/pet lawn ball ${item}`, '', Utils.itemStyle(item)
					)).join(' ')}`);
				}
			},

			'gen': 'add',
			add(target, room, user) {
				this.checkCan('bypassall');
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				if (PetBattle.legends[room.roomid]) return this.popupReply(`${room.title} 房间里的宝可梦还未被捕获`);
				const targets = target.split(',');
				target = targets[0];
				const species = Dex.species.get(target);
				if (!species.exists) return this.popupReply(`Usage: /add 宝可梦, 等级, 闪光率`);
				const level = parseInt(targets[1]) || 70;
				const shiny = parseInt(targets[2]) || 0;
				PetBattle.legends[room.roomid] = `${species.name}|${level}|${shiny}`;
				const legendStyle = 'font-size: 12pt; text-align: center; height: 170px';
				room.add(`|uhtmlchange|pet-legend|`);
				room.add(
					`|uhtml|pet-legend|<div class='broadcast-green' style="${legendStyle}">` +
					`<strong>野生的 ${species.name} 出现了!</strong><br/>` +
					`${Utils.image(
						`background: url(${POKESPRITES}/${Pet.spriteId(target)}.gif) no-repeat center;` +
						`width: 100%; height: 120px`
					)}<br/>` +
					`${Utils.button('/pet lawn search !', '挑战!')}</div>`
				)
			},

			'rm': 'remove',
			remove(target, room, user) {
				this.checkCan('bypassall');
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				if (PetBattle.legends[room.roomid]) {
					room.add(`|uhtmlchange|pet-legend|`);
					room.add(`|uhtml|pet-legend|<div class='broadcast-green' style="text-align: center;"><strong>野生的 ${
						PetBattle.legends[room.roomid].split('|')[0]
					} 离开了。</strong></div>`);
					delete PetBattle.legends[room.roomid];
					this.popupReply(`已删除 ${room.title} 房间里的宝可梦`);
				}
			},

		},

		shop: {

			'': 'show',
			async show(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				this.parse('/pet box clear');
				this.parse('/pet shop clear');
				const targets = target.split('=>');
				const goodtype = Shop.types[targets[0]] ? targets[0] : 'ball';
				const goods = Shop.shopConfig[goodtype];
				const goodname = targets[1];
				let title = `${Utils.button('/pet shop buy ball=>Poke Ball!', '领取5个精灵球!')}` +
					`${Utils.button('/pet shop draw', '领取随机道具!')}<br/>` +
					`${Object.keys(Shop.types).map(x => Utils.button(`/pet shop show ${x}`, Shop.types[x])).join('')}`;
				if (goods[goodname]) {
					const price = goods[goodname];
					if (price > 0) {
						title = `购买 ${goodname} ? (${price}积分/1个)<br/>${title}<br/>` +
							Utils.button(`/pet shop buy ${goodtype}=>${goodname}!`, '购买5个!') +
							Utils.button(`/pet shop buy ${goodtype}=>${goodname}`, '购买1个') +
							Utils.button(`/pet shop show ${goodtype}`, '取消');
					} else {
						title = `领取5个 ${goodname} ?<br/>${title}<br/>` +
							`${Utils.boolButtons(`/pet shop buy ${goodtype}=>${goodname}!`, `/pet shop show ${goodtype}`)}`;
					}
				} else {
					title = `请选择商品:<br/>${title}<br/>` +
						`${Utils.button(`/score pop`, '查看积分')}${Utils.button(`/pet box`, '返回')}`
				}
				title = `<div><strong>${title}</strong></div>`;
				user.sendTo(room.roomid, `|uhtml|pet-shop-show|${title}<div style="border: ridge;">`
					+ `${Shop.goodButtons[goodtype]}</div>`);
			},

			async buy(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				const targets = target.split('=>');
				const goodtype = targets[0];
				if (!Shop.types[goodtype]) return this.popupReply(`没有名为 ${goodtype} 的商品种类`);
				// if (!(await addScore(user.name, 0))[0]) this.popupReply("您没有国服积分, 不能购买商品哦");
				const goods = Shop.shopConfig[goodtype];
				let goodname = targets[1];
				const goodnames = goodname.split('!');
				goodname = goodnames[0];
				let num = goodnames.length > 1 ? 5 : 1;
				if (!goods[goodname]) return this.popupReply(`没有名为 ${goodname} 的${Shop.types[goodtype]}!`);
				const price = goods[goodname];
				petUser.load();
				if (price > 0) {
					const changeScores = await addScore(user.name, -price * num);
					if (changeScores.length !== 2) return this.popupReply(`积分不足!`);
					this.popupReply(`您获得了${num}个 ${goodname} ! 您现在的积分是: ${changeScores[1]}`);
				} else {
					if (Date.now() - petUser.property['time']['ball'] < BALLCD) {
						return this.popupReply(`您在${Math.floor(BALLCD / 60000)}分钟内已领取过 ${goodname} !`);
					}
					if (petUser.property['items'][goodname]) {
						let validNum = Math.min(num, 10 - petUser.property['items'][goodname]);
						if (num > validNum) {
							num = validNum;
							this.popupReply(`由于免费道具最多只能持有10个, 您领取了${num}个 ${goodname}`);
						}
					}
					if (num > 0) petUser.property['time']['ball'] = Date.now();
				}
				petUser.addItem(goodname, num);
				petUser.save();
				this.parse('/pet box');
			},

			draw(target, room, user) {
				const petUser = getUser(user.id);
				if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
				petUser.load();
				const day = Math.floor(Date.now() / 24 / 60 / 60 / 1000);
				if (day <= petUser.property['time']['draw']) return this.popupReply("您今日已领取随机道具!");
				const randomItem = prng.sample(Object.keys(PetModeShopConfig['draw']));
				petUser.property['time']['draw'] = day;
				petUser.addItem(randomItem, 1);
				petUser.save();
				this.popupReply(`您获得了1个 ${randomItem}!`);
				this.parse(`/pet box show ${petUser.onPosition ? Object.values(petUser.onPosition).join(',') : ''}`)
			},

			clear(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				user.sendTo(room.roomid, `|uhtmlchange|pet-shop-show|`);
			}

		},

		edit(target, room, user) {
			this.checkCan('bypassall');
			if (!room) return this.popupReply("请在房间里使用宠物系统");
			const petUser = getUser(user.id);
			if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
			petUser.load();
			user.sendTo(room.roomid, `|uhtmlchange|pet-edit|`);
			if (target) {
				switch (target.split('!').length) {
					case 2:
						return user.sendTo(
							room.roomid,
							`|uhtml|pet-edit|确认删除?&emsp;${Utils.boolButtons('/pet edit !!', '/pet edit')}`
						);
					case 3:
						dropUser(user.id);
						petUser.destroy();
						return this.popupReply(`用户数据已删除`);
					default:
						if (petUser.editProperty(target)) {
							petUser.save();
							this.parse('/pet box');
							return this.popupReply(`修改成功!`);
						} else {
							this.popupReply(`格式错误!`);
						}
				}
			}
			user.sendTo(room.roomid, `|uhtml|pet-edit|您的盒子:<br/>` + 
				`<input type="text" style="width: 100%" value='${JSON.stringify(petUser.property)}'/>` +
				`修改盒子: /pet edit {"bag":["宝可梦1",...],"box":["宝可梦2",...],"items":{"道具1":数量1,...}}<br/>` +
				Utils.button('/pet edit !', '删除用户数据')
			);
		},

		receive(target, room, user) {
			const petUser = getUser(user.id);
			if (!petUser.property) return this.popupReply("您还未领取最初的伙伴!");
			const gift = new PetUser(user.id, GIFTPATH);
			if (!gift.property) return this.popupReply('没有可以领取的礼物!');

			petUser.load();
			const received = petUser.merge(gift);
			let replies = [];
			for (let itemname in received['items']) replies.push(`您获得了${received['items'][itemname]}个 ${itemname} !`);
			for (let petspecies of received['bag']) replies.push(`您获得了 ${petspecies} !`);
			if (gift.property['bag'].length > 0) {
				replies.push(`您的盒子没有空位了!`);
				gift.save();
			} else {
				gift.destroy();
			}
			petUser.save();
			this.popupReply(replies.join('\n'));
		},

		'': 'help',
		help(target, room, user) {
			if (!room) return this.popupReply("请在房间里使用宠物系统");
			user.sendTo(room.roomid, `|uhtmlchange|pet-welcome|`);
			let buttons = [
				Utils.button('/pet init', '领取最初的伙伴!'),
				Utils.button('/pet lawn', '寻找野生的宝可梦!'),
				Utils.button('/pet box', '盒子'),
				Utils.button('/pet shop', '商店'),
			];
			if (PetBattle.legends[room.roomid]) {
				buttons.push(Utils.button('/pet lawn search !', `挑战房间里的 ${PetBattle.legends[room.roomid].split('|')[0]} !`));
			}
			if (FS( `${GIFTPATH}/${user.id}.json`).existsSync()) {
				buttons.push(Utils.button('/pet receive', '领取礼物!'));
			}
			user.sendTo(
				room.roomid,
				`|uhtml|pet-welcome|<strong>欢迎来到Pokemon Showdown China宠物系统!</strong><br/>${buttons.join(' ')}`
			);
		}

	}

}