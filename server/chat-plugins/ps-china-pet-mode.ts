/*
	Pokemon Showdown China Pet Mode Version 1.0 Author: Starmind
	petmod format: randomteam: 调用<username>.json，如果没有则鲤鱼王
	/init: 领取第一只宝可梦
	/box: 盒子UI(所有抓过的精灵, 指定默认队伍, 调出精灵UI); 精灵UI(等级, 性格, 个体, 进化, 招式)
	/find: 随机遇到精灵(房间config); /petmodbattle: 生成petmod对战; /ball: 抓生成的精灵, 在房间则开启与当前神兽的对战
	/genpoke: 在房间根据config生成精灵 (无参数: 根据roomconfig.json)
	bot: 生成的petmod对战的对手; 定时在所有房间/genpoke
	pschinascore: 购买道具, 盒子上限; 特殊道具: 神奇糖果, 修改性格等
	config/petmode/user-properties/<username>.json: {
		'bag': ['Alakazam||||psychic,seismictoss,thunderwave,recover||252,252,252,252,252,252|||||', ...],
		'box': ['Alakazam||||psychic,seismictoss,thunderwave,recover||252,252,252,252,252,252|||||', ...],
		'items': {'Master Ball': 1, 'Rare Candy': 5}
	}
	config/pet-mode/room-config.json: {'SkyPillar': {
		'find': {'freqs': [0.9, 0.1], 'pokes': ['Pikachu|||||||||||', 'Alakazam|||||||||||']},
		'gen': {'freqs': [0.9, 0.1], 'pokes': ['Pikachu|||||||||||', 'Alakazam|||||||||||']}
	}}
	维护字典pokeInRooms = {'SkyPillar': Pokemon(Alakazam)}
	Sky Pillar Room Intro: /box按钮
*/

import { FS } from "../../lib";
import { PRNG } from "../../sim";
import { addScore } from "./ps-china-admin";
import { PokemonIconIndexes } from "../../config/pet-mode/poke-num";
import { PetModeRoomConfig } from "../../config/pet-mode/room-config";
import { PetModeShopConfig } from "../../config/pet-mode/shop-config";

type pokeList = string[];
type itemList = { [itemName: string]: number };
type userProperty = { 'bag': pokeList, 'box': pokeList, 'items': itemList };
type pokePosition = { 'type': 'bag' | 'box', 'index': number };

const prng = new PRNG();

const BOTID = 'pschinabot';
const USERPATH = 'config/pet-mode/user-properties';
const POKESHEET = 'https://play.pokemonshowdown.com/sprites/pokemonicons-sheet.png';
const POKESPRITES = 'https://play.pokemonshowdown.com/sprites/ani';
const POKESPRITESSHINY = 'https://play.pokemonshowdown.com/sprites/ani-shiny';
const ITEMSHEET = 'https://play.pokemonshowdown.com/sprites/itemicons-sheet.png';

const LAWNCD = 60000;
const BALLCD = 600000;

if (!FS(USERPATH).existsSync()) FS(USERPATH).mkdir();

const DEFAULTWILDMONS = [
	'Caterpie', 'Weedle', 'Ledyba', 'Spinarak', 'Wurmple', 'Kricketot', 'Sewaddle', 'Venipede',
	'Scatterbug', 'Grubbin', 'Blipbug', 'Poochyena', 'Shinx', 'Lillipup', 'Purrloin', 'Nickit',
	'Pidgey', 'Hoothoot', 'Taillow', 'Starly', 'Pidove', 'Fletchling', 'Pikipek', 'Rookidee',
	'Rattata', 'Sentret', 'Zigzagoon', 'Bidoof', 'Patrat', 'Bunnelby', 'Yungoos', 'Skwovet',
];

const INITMONBUTTONS = [
	'Bulbasaur', 'Chikorita', 'Treecko', 'Turtwig', 'Snivy', 'Chespin', 'Rowlet', 'Grookey', '<br/>',
	'Charmander', 'Cyndaquil', 'Torchic', 'Chimchar', 'Tepig', 'Fennekin', 'Litten', 'Scorbunny', '<br/>',
	'Squirtle', 'Totodile', 'Mudkip', 'Piplup', 'Oshawott', 'Froakie', 'Popplio', 'Sobble',
].map(x => {
	return x === '<br/>' ? x : messageButton(`/pet init set ${x}`, '', getIconStyle(x));
}).join('');

const VALIDBALLS: {[ballname: string]: number} = {'Poke Ball': 1, 'Great Ball': 2, 'Ultra Ball': 4, 'Master Ball': Infinity};

const VALIDGOODS = Dex.items.all().map(item => item.name).filter(itemname => {
	return (itemname.indexOf(' Ball') < 0 || ['Iron Ball', 'Light Ball', 'Air Balloon'].indexOf(itemname) >= 0) &&
		itemname.indexOf('ite') !== itemname.length - 3 && itemname.indexOf('ite') !== itemname.length - 5 &&
		itemname.indexOf(' Z') !== itemname.length - 2 &&
		itemname.indexOf(' Gem') !== itemname.length - 4 &&
		itemname.indexOf(' Plate') !== itemname.length - 6 &&
		itemname.indexOf(' Memory') !== itemname.length - 7 &&
		itemname.indexOf('Power ') !== 0 &&
		itemname.indexOf('TR') < 0;
});

const GOODNAMES = Object.keys(VALIDBALLS).concat(VALIDGOODS);

const GOODBUTTONS = Object.keys(VALIDBALLS).map(itemname => {
	return messageButton(`/pet shop show ${itemname}`, '', getItemStyle(itemname));
}).join('') + '<br/>' + VALIDGOODS.map(itemname => {
	return messageButton(`/pet shop show ${itemname}`, '', getItemStyle(itemname));
}).join('');

const LEARNLEVEL: {[speciesid: string]: {[moveid: string]: number}} = {}
for (let speciesid in Dex.data.Learnsets) {
	LEARNLEVEL[speciesid] = {};
	const moves = Dex.data.Learnsets[speciesid].learnset;
	for (let moveid in moves) {
		// (condition.indexOf('T') >= 0 || condition.indexOf('E') >= 0)
		let minLevel = 101;
		for (let i = moves[moveid].length - 1; i >= 0; i--) {
			const condition = moves[moveid][i];
			if (condition.indexOf('L') >= 0) {
				minLevel = Math.min(minLevel, parseInt(condition.split('L')[1]));
				break;
			}
		}
		if (minLevel > 100) {
			minLevel = Math.min(minLevel, hashLevel(speciesid + moveid));
		}
		LEARNLEVEL[speciesid][moveid] = minLevel;
	}
}

let userOnEx: { [userid: string]: string } = {};
let userSearch: { [userid: string]: number } = {};
let userOnDrop: { [userid: string]: string } = {};
let userLookAt: { [userid: string]: string } = {};
let userGetBall: { [userid: string]: number } = {};
let userOnBattle: { [userid: string]: string } = {};
let userEvoStage: { [userid: string]: string | false } = {};
let userProperties: { [userid: string]: userProperty } = {};
let userOnChangeMoves: { [userid: string]: { 'position': pokePosition, 'selected': string[], 'valid': string[] } } = {}
FS(USERPATH).readdirSync().forEach((x: string) => {
	userProperties[x.split('.')[0]] = JSON.parse(FS(`${USERPATH}/${x}`).readIfExistsSync());
});

function restrict(x: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, x));
}

function hashLevel(s: string): number {
	let hash = 0, i, chr;
	if (s.length === 0) return hash;
	for (i = 0; i < s.length; i++) {
		chr   = s.charCodeAt(i);
		hash  = ((hash << 5) - hash) + chr;
		hash |= 0;
	}
	return Math.abs(hash) % 100 + 1;
};

function getImage(style: string) {
	return `<img style="${style}"/>`;
}

function getItemStyle(name: string) {
	const num = Dex.items.get(name).spritenum || 0;
	let top = Math.floor(num / 16) * 24;
	let left = (num % 16) * 24;
	return `background:transparent url(${ITEMSHEET}?g8) no-repeat scroll -${left}px -${top}px; height: 24px; width: 24px;`
}

function getIconStyle(name: string) {
	const pokemon = Dex.species.get(name);
	const num = PokemonIconIndexes[pokemon.id] || pokemon.num;
	if (num <= 0) {
		// return `background:transparent url(${POKESHEET}) no-repeat scroll -0px 4px;height: 32px;width: 40px;`
		return `height: 32px; width: 40px;`
	}
	const top = Math.floor(num / 12) * 30;
	const left = (num % 12) * 40;
	return `background: transparent url(${POKESHEET}?v5) no-repeat scroll -${left}px -${top}px; height: 32px; width: 40px;`;
}

function messageButton(message: string, desc: string, style: string = '', highlight: boolean = false) {
	const HLStyle = highlight ? 'border: double;' : '';
	return `<button style="${style} ${HLStyle}" class="button" name="send" value="${message}">${desc}</button>`
}

function boolButtons(yesMessage: string, noMessage: string) {
	return messageButton(yesMessage, '确认') + messageButton(noMessage, '取消');
}

function randomIvs(): StatsTable {
	let intArray = [...new Array(32).keys()];
	return {hp: prng.sample(intArray), atk: prng.sample(intArray), def: prng.sample(intArray),
		spa: prng.sample(intArray), spd: prng.sample(intArray), spe: prng.sample(intArray)};
}

function initUserProperty(): userProperty {
	return {'bag': new Array(6).fill(''), 'box': new Array(30).fill(''), 'items': {'Poke Ball': 5}}
}

function loadUser(userid: string) {
	const userPropString = FS(`${USERPATH}/${userid}.json`).readIfExistsSync();
	if (userPropString) userProperties[userid] = JSON.parse(userPropString);
}

function saveUser(userid: string) {
	FS(`${USERPATH}/${userid}.json`).writeSync(JSON.stringify(userProperties[userid]));
}

function removeUser(userid: string) {
	FS(`${USERPATH}/${userid}.json`).unlinkIfExistsSync();
}

function completeSet(set: PokemonSet): PokemonSet {
	const species = Dex.species.get(set.name);
	if (!set.ability) set.ability = species.abilities["0"];
	if (!set.evs) set.evs = {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0};
	if (!set.ivs) set.ivs = {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31};
	if (!set.shiny) set.shiny = false;
	return set;
}

function getValidMoves(speciesid: string, level: number): string[] {
	if (!(speciesid in LEARNLEVEL)) return [];
	return Object.keys(LEARNLEVEL[speciesid]).filter(moveid => {
		return LEARNLEVEL[speciesid][moveid] <= level;
	}).concat(getValidMoves(toID(Dex.species.get(speciesid).prevo), level));
}

function genRandomMoves(species: string, level: number): string[] {
	let validMoves = getValidMoves(species, level);
	prng.shuffle(validMoves);
	return validMoves.slice(0, 4); 
}

function listStats(stats: StatsTable): string {
	return `[HP:${stats.hp}|攻击:${stats.atk}|防御:${stats.def}|特攻:${stats.spa}|特防:${stats.spd}|速度:${stats.spe}]`;
}

function parsePosition(target: string): pokePosition | null {
	const targets = target.split(',').map(x => x.trim());
	if (targets.length !== 2 || (targets[0] !== 'bag' && targets[0] !== 'box')) {
		return null;
	}
	const index = parseInt(targets[1]);
	if (index === NaN || index < 0 || index > (targets[0] === 'bag' ? 5 : 35)) {
		return null;
	}
	return {'type': targets[0], 'index': index};
}

function parseSet(pos: pokePosition, userid: string): PokemonSet | null {
	const floatLevel = parseFloat(userProperties[userid][pos['type']][pos['index']].split('|')[10]) || 100;
	const sets = Teams.unpack(userProperties[userid][pos['type']][pos['index']]);
	if (!sets) return null;
	sets[0].level = floatLevel;
	return completeSet(sets[0]);
}

function exchangeSet(target1: string, target2: string, userid: string): boolean | null {
	const pos1 = parsePosition(target1);
	const pos2 = parsePosition(target2);
	if (!pos1 || !pos2) return null;
	loadUser(userid);
	const set1 = userProperties[userid][pos1['type']][pos1['index']];
	const set2 = userProperties[userid][pos2['type']][pos2['index']];
	const bagSize = userProperties[userid]['bag'].filter(x => x).length;
	if (bagSize <= 1 && (
		(pos1['type'] === 'bag' && pos2['type'] === 'box' && !set2) ||
		(pos2['type'] === 'bag' && pos1['type'] === 'box' && !set1)
	)) return false;
	userProperties[userid][pos1['type']][pos1['index']] = set2;
	userProperties[userid][pos2['type']][pos2['index']] = set1;
	saveUser(userid);
	return true;
}

function getAvailableEvos(set: PokemonSet): (string)[][] {
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
				// case 'trade':
				// 	return false;
				default:
					return set.level > 35 ? [x, ''] : [];
			}
		}
		return set.level >= (species.evoLevel || 100) ? [x, ''] : [];
	}).filter(x => x.length === 2);	
}

function inPetModeBattle(userid: string): string | undefined {
	const battleWithBot = (roomid: string) => {
		const battle = Rooms.get(roomid)?.battle;
		return battle && (battle.p1.id === BOTID || battle.p2.id === BOTID) &&
			(battle.p1.id === userid || battle.p2.id === userid) && !battle.ended;
	}
	const user = Users.get(userid);
	if (!user) return undefined;
	return [...user.inRooms].filter(x => x.indexOf('petmode') >= 0 && battleWithBot(x))[0];
}

function genPoke(speciesid: string, level: number, fullivs: boolean = false, happy: number = 0, shiny: number = 1 / 256): string {
	level = restrict(level, 1, 100);
	const species = Dex.species.get(speciesid);
	if (species.num <= 0) return '';
	const set: PokemonSet = {
		name: species.name,
		species: species.name,
		item: "",
		ability: species.abilities["1"] ? prng.sample([species.abilities["0"], species.abilities["1"]]) : species.abilities["0"],
		moves: genRandomMoves(species.id, level),
		nature: prng.sample(Dex.natures.all()).name,
		gender: prng.randomChance(Math.floor(species.genderRatio.M * 1000), 1000) ? 'M' : 'F',
		evs: {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0},
		ivs: fullivs ? {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31} : randomIvs(),
		level: level,
		happiness: happy,
		shiny: prng.randomChance(shiny * 1000, 1000),
	};
	return Teams.pack([set]);
}

function getAvailableBalls(userid: string): string[] {
	const items = Object.keys(userProperties[userid]['items']);
	return Object.keys(VALIDBALLS).filter(ballname => items.indexOf(ballname) >= 0);
}

function genWildPoke(roomid: string, maxLevel: number): string {
	if (roomid in PetModeRoomConfig) {
		const roomConfig: {'lawn': string[], 'minlevel': number, 'maxlevel': number} = PetModeRoomConfig[roomid];
		return genPoke(
			prng.sample(roomConfig['lawn'] || DEFAULTWILDMONS),
			prng.sample([...new Array(11).keys()].map(x => x + restrict(maxLevel, roomConfig['minlevel'], roomConfig['maxlevel']) - 5))
		);
	}	
	return genPoke(
		prng.sample(DEFAULTWILDMONS),
		prng.sample([...new Array(11).keys()].map(x => x + restrict(maxLevel, 5, 20) - 5))
	);
}

function ifCatchSuccessful(turn: number, ball: string, species: string, levelRate: number, rare: boolean = false): boolean {
	const rareLevel = rare ? 10 : 1;
	const ballLevel = VALIDBALLS[ball] || 1;
	const catchLevel = Math.pow(eval(Object.values(Dex.species.get(species).baseStats).join('+')), 2) / Math.pow(200, 2) + 1;
	const chance = prng.randomChance(Math.log10((turn + 5) * levelRate) / catchLevel * ballLevel * rareLevel * 1000, 1000);
	return chance;
}

function parseProperty(propertyString: string): userProperty | null {
	try {
		const parsed = JSON.parse(propertyString);
		const property: userProperty = initUserProperty();
		let items: itemList = {};
		for (let item in parsed['items']) {
			const parsedNum = parseInt(parsed['items'][item]);
			if (parsedNum !== NaN) items[item] = parsedNum;
		}
		Object.assign(property['items'], items);
		Object.assign(property['bag'], parsed['bag'].map((x: string) => Teams.pack(Teams.unpack(x))));
		if (parsed['box']) Object.assign(property['box'], parsed['box'].map((x: string) => Teams.pack(Teams.unpack(x))));
		if (property['bag'].filter(x => x).length === 0) return null;
		return property;
	} catch (err) {
		return null;
	}
}

function addExperience(userid: string, foelevel: number): boolean {
	let levelUp = false;
	let userProperty= userProperties[userid];
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
			features[6] = evs.map((x: number) => Math.min(x + prng.sample([1, 2, 3]), 255)).join(',');
			features[11] = Math.min((features[11] ? parseInt(features[11]) : 255) + 10, 255).toString();
			userProperty['bag'][index] = features.join('|');
		}
	}
	return levelUp;
}

export const commands: Chat.ChatCommands = {

	'petmode': 'pet',
	pet: {

		init: {

			'': 'show',
			show(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				if (user.id in userProperties) return this.parse('/pet init guide');
				this.parse('/pet init clear');
				user.sendTo(room.roomid, `|uhtml|pet-init-show|欢迎使用宠物系统!请选择您最初的伙伴：<br/>${INITMONBUTTONS}`);
			},

			set(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				if (user.id in userProperties) return this.parse('/pet init guide');
				this.parse('/pet init clear');
				user.sendTo(room.roomid, `|uhtml|pet-init-show|确认选择<div style="${getIconStyle(target)}"></div>作为您最初的伙伴?${
					boolButtons(`/pet init confirm ${target}`, '/pet init show')
				}`);
			},

			confirm(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				if (user.id in userProperties) return this.parse('/pet init guide');
				const initPoke = genPoke(target, 5, true, 70);
				if (!initPoke) return this.popupReply(`${target}不是合法的宝可梦`)
				userProperties[user.id] = initUserProperty();
				userProperties[user.id]['bag'][0] = initPoke;
				saveUser(user.id);
				this.parse('/pet init clear');
				user.sendTo(room.roomid, `|uhtml|pet-init-show|您获得了：<div style="${
					getIconStyle(target)
				}"></div>`);
				this.parse('/pet init guide');
			},

			guide(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				this.parse('/pet init clear');
				user.sendTo(room.roomid, `|uhtml|pet-init-show|您已领取最初的伙伴!快进入 ${
					messageButton('/pet box show', '盒子')
				} 查看吧!`);
			},

			clear(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				user.sendTo(room.roomid, `|uhtmlchange|pet-init-show|`);
			}

		},

		box: {

			'': 'show',
			show(target, room, user) {
				delete userLookAt[user.id];
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				if (!(user.id in userProperties)) return this.popupReply("您还未领取最初的伙伴!");
				this.parse('/pet init clear');
				this.parse('/pet shop clear');

				loadUser(user.id);
				let pokeDiv = ``;
				if (target) {
					const position = parsePosition(target);
					if (!position) return this.popupReply('位置不存在!');
					const set = parseSet(position, user.id);
					if (!set) return this.parse('/pet box show');
					userLookAt[user.id] = target.split(' ').join('');
					const lineStyle = "display: inline-block; vertical-align: middle; width: 100%; height: 30px; line-height: 30px;";
					const st = (x: string) => `<strong>${x}</strong>`;
					let exButton = messageButton(`/pet box onex ${target}`, '移动');
					if (user.id in userOnEx) exButton = st('请选择位置');
					let evoButton = messageButton(`/pet box evo ${target}`, '进化');
					if (user.id in userEvoStage) {
						if (userEvoStage[user.id]) {
							evoButton = st('确认进化? ') +
								boolButtons(`/pet box evo ${target}=>${userEvoStage[user.id]}`, `/pet box evo ${target}`);
						} else {
							evoButton = st('请选择进化型: ') + getAvailableEvos(set).map(x => {
								return messageButton(`/pet box evo ${target}=>${x[0]}`, '', getIconStyle(x[0]));
							}).join('') + ' ' + messageButton(`/pet box evo !`, '取消');
						}
					}
					let dropButton = messageButton(`/pet box drop ${target}`, '放生');
					if (userOnDrop[user.id]) {
						dropButton = `${st('确认放生? ')}${boolButtons(`/pet box drop ${target}!`, `/pet box drop ${target}`)}`;
					}
					const lines = [
						`${st('昵称')}: ${set.name}  ${st('种类')}: ${set.species}`,
						`${st('性别')}: ${set.gender === 'M' ? '♂' : set.gender === 'F' ? '♀' : '∅'}  ` +
						`${st('亲密度')}: ${set.happiness !== undefined ? set.happiness : 255}  ${exButton}`,
						`${st('等级')}: ${Math.floor(set.level)} (${Math.floor((set.level - Math.floor(set.level)) * 100)}%)  ` + 
						`${st('道具')}: ${set.item ? messageButton(`/pet box item ${target}`, '', getItemStyle(set.item)) : '无道具'}`,
						`${dropButton}  ${evoButton}`,
						`${st('性格')}: ${set.nature}  ${st('特性')}: ${set.ability}`,
						`${st('个体值')}: ${listStats(set.ivs)}`,
						`${st('努力值')}: ${listStats(set.evs)}`,
						`${st('招式')}: [${set.moves.toString().split(',').join('|')}]  ` +
						`${messageButton(`/pet box moves ${target}`, '更改招式')}`
					]
					const spriteURL = `${set.shiny ? POKESPRITESSHINY : POKESPRITES}/${toID(set.species)}.gif`;
					const sprite = `background: transparent url(${spriteURL}) no-repeat 70% 10% relative;`
					pokeDiv = `<section style="${sprite} position: relative; display: inline-block; ` +
						`vertical-align: top; width: 450px; height: '100%'; padding: 5px;` +
						`">${lines.map(x => `<div style="${lineStyle}">${x}</div>`).join('')}</section>`;
				}

				const petButton = (species: string, target: string) => {
					const style = getIconStyle(species);
					if (user.id in userOnEx) return messageButton(`/pet box ex ${userOnEx[user.id]}<=>${target}`, '', style);
					return messageButton(`/pet box show ${target}`, '', style, userLookAt[user.id] === target.split(' ').join(''));
				};
				const bagMons = userProperties[user.id]['bag'].map((x, i) =>
					petButton(x.split('|')[1] || x.split('|')[0], `bag,${i}`)).join('') + '<br/>';
				const boxMons = userProperties[user.id]['box'].map((x, i) =>
					petButton(x.split('|')[1] || x.split('|')[0], `box,${i}`) + (i % 6 == 5 ? '<br/>' : '')).join('');
				let items = ``;
				// let itemButton = (item: string) => getImage(getItemStyle(item));
				// if (user.id in userLookAt) {
				// 	itemButton = (item: string) => messageButton(getItemStyle(item), `/pet box item ${target}=>${item}`, '');
				// }
				const itemButton = (item: string) => messageButton(
					(user.id in userLookAt) ? `/pet box item ${target}=>${item}` : '', '', getItemStyle(item)
				);
				const itemNum = (x: number) => x > 0 ? x : '∞';
				for (let itemName in userProperties[user.id]['items']) {
					items += `${itemButton(itemName)}x${itemNum(userProperties[user.id]['items'][itemName])} `;
				}
				const shopButton = messageButton('/pet shop', '商店');
				let boxDiv = `<section style="` + 
					`position: relative; vertical-align: top; display: inline-block;width: 250px; height: '100%'; padding: 5px;` +
					`"><strong>背包<br/>${bagMons}盒子<br/>${boxMons}道具</strong><br/>${items}${shopButton}</section>`;

				// TODO: 电脑模式: boxDiv position: absolute; pokeDiv left: 260px;
				this.parse('/pet box clear');
				user.sendTo(room.roomid, `|uhtml|pet-box-show|<div style="height: 300">${boxDiv}${pokeDiv}</div>`);
			},

			onex(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				userOnEx[user.id] = target;
				this.parse(`/pet box show ${target}`);
			},

			ex(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				delete userOnEx[user.id];
				const targets = target.split('<=>').map(x => x.trim());
				if (targets.length !== 2) return this.popupReply(`Usage: /pet box ex [bag|box],position1<=>[bag|box],position2`);
				const result = exchangeSet(targets[0], targets[1], user.id);
				if (result === null) return this.popupReply(`位置不存在!`);
				if (result === false) return this.popupReply(`背包不能为空!`);
				this.parse(`/pet box show ${targets[1]}`);
			},

			evo(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				// [进化]: userEvoStage <- false, /pet box show = 希望的进化型(/pet box evo target=>goal)
				// [选择进化型]: userEcoStarge <- goal, /pet box show = 确认(/pet box evo target=>goal) | 取消(/pet box evo target)
				// [确认]: delete userEcoStarge, /pet box show = 进化(/pet box evo target)
				if (target.indexOf('!') >= 0) {
					delete userEvoStage[user.id];
					return this.parse(`/pet box show ${userLookAt[user.id] || ''}`);
				}
				const targets = target.split('=>').map(x => x.trim());
				target = targets[0];
				const position = parsePosition(target);
				if (!position) return this.popupReply('位置不存在!');
				loadUser(user.id);
				const set = parseSet(position, user.id);
				if (!set) return this.popupReply('位置是空的!');
				const availableEvos = getAvailableEvos(set);
				if (availableEvos.length === 0) {
					return this.popupReply('不满足进化条件!');
				}
				if (user.id in userEvoStage) {
					if (targets.length !== 2) {
						delete userEvoStage[user.id];
					} else {
						if (userEvoStage[user.id]) {
							const index = availableEvos.map(x => x[0]).indexOf(targets[1]);
							if (index < 0) return this.popupReply('进化型不合法!');
							if (availableEvos[index][1]) set.item = '';
							if (set.species === set.name) set.name = targets[1];
							set.species = targets[1];
							userProperties[user.id][position['type']][position['index']] = Teams.pack([set]);
							saveUser(user.id);
							delete userEvoStage[user.id];
							this.popupReply('进化成功!');
						} else {
							userEvoStage[user.id] = targets[1];
						}
					}
				} else {
					userEvoStage[user.id] = false;
				}
				this.parse(`/pet box show ${target}`);
			},
	
			item(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const targets = target.split('=>').map(x => x.trim());
				target = targets[0];
				const position = parsePosition(target);
				if (!position) return this.popupReply('位置不存在!');
				loadUser(user.id);
				const set = parseSet(position, user.id);
				if (!set) return this.popupReply('位置是空的!');

				if (set.item) {
					if (!(set.item in userProperties[user.id]['items'])) {
						userProperties[user.id]['items'][set.item] = 0;
					}
					userProperties[user.id]['items'][set.item] += 1;
					set.item = '';
				}
				if (targets[1] && targets[1] in userProperties[user.id]['items']) {
					set.item = targets[1];
					userProperties[user.id]['items'][targets[1]] -= 1;
					if (userProperties[user.id]['items'][targets[1]] === 0) {
						delete userProperties[user.id]['items'][targets[1]];
					}
				}
				userProperties[user.id][position['type']][position['index']] = Teams.pack([set]);
				saveUser(user.id);

				this.parse(`/pet box show ${target}`);
			},
	
			moves(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const targets = target.split('=>').map(x => x.trim());
				target = targets[0];
				const position = parsePosition(target);
				if (!position) return this.popupReply('位置不存在!');
				loadUser(user.id);
				const set = parseSet(position, user.id);
				if (!set) return this.popupReply('位置是空的!');
				if (!(user.id in userOnChangeMoves)) {
					userOnChangeMoves[user.id] = {
						'position': position,
						'selected': [],
						'valid': getValidMoves(toID(set.species), set.level).map(x => Dex.moves.get(x).name)
					};
				}
				const section = (x: string) =>
					`<section style="display: inline-block; position: relative; width: 160px; padding: 5px;` +
					` height: 150px; overflow: auto; vertical-align: top;">${x}</section>`;
				const valid = userOnChangeMoves[user.id]['valid'].map(move =>
					messageButton(`/pet box addmove ${target}=>${move}`, move, 'width: 140px;')
				).join('<br/>');
				const selected = userOnChangeMoves[user.id]['selected'].map(move =>
					messageButton(`/pet box addmove ${target}=>${move}`, move, 'width: 140px;')
				).join('<br/>');
				const buttons = boolButtons(`/pet box setmoves ${target}!`, `/pet box setmoves ${target}`);
				user.sendTo(room.roomid, `|uhtmlchange|pet-moves-show|`);
				user.sendTo(room.roomid, `|uhtml|pet-moves-show|${section(`${selected}<br/><br/>${buttons}`)}${section(valid)}`);
			},

			addmove(target, room, user) {
				const targets = target.split('=>');
				if (targets.length !== 2) return this.popupReply('请先指定需要更改招式的宝可梦');
				if (!(user.id in userOnChangeMoves)) return this.popupReply('请先指定需要更改招式的宝可梦');
				const selectedIndex = userOnChangeMoves[user.id]['selected'].indexOf(targets[1]);
				if (selectedIndex >= 0) {
					userOnChangeMoves[user.id]['selected'].splice(selectedIndex, 1);
					return this.parse(`/pet box moves ${target}`);
				}
				const validIndex = userOnChangeMoves[user.id]['valid'].indexOf(targets[1]);
				if (validIndex >= 0 && userOnChangeMoves[user.id]['selected'].length < 4) {
					userOnChangeMoves[user.id]['selected'].push(targets[1]);
					return this.parse(`/pet box moves ${target}`);
				}
			},

			setmoves(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const targets = target.split('!').map(x => x.trim());
				loadUser(user.id);
				target = targets[0];
				if (targets.length === 2 && userOnChangeMoves[user.id] && userOnChangeMoves[user.id]['selected'].length > 0) {
					const position = parsePosition(target);
					if (!position) return this.popupReply('位置不存在!');
					const set = parseSet(position, user.id);
					if (!set) return this.popupReply('位置是空的!');
					set.moves = userOnChangeMoves[user.id]['selected'];
					userProperties[user.id][position['type']][position['index']] = Teams.pack([set]);
					saveUser(user.id);
				}
				this.parse(`/pet box show ${target}`);
			},

			drop(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const targets = target.split('!').map(x => x.trim());
				target = targets[0];
				loadUser(user.id);
				const position = parsePosition(target);
				if (!position) return this.popupReply('位置不存在!');
				const set = parseSet(position, user.id);
				if (!set) return this.popupReply('位置是空的!');
				if (user.id in userOnDrop && target === userOnDrop[user.id] && targets.length === 2) {
					if (position['type'] === 'bag' && userProperties[user.id]['bag'].filter(x => x).length <= 1) {
						delete userOnDrop[user.id];
						this.popupReply('背包不能为空!');
					} else {
						if (set.item) this.parse(`/pet box item ${target}`);
						userProperties[user.id][position['type']][position['index']] = '';
						delete userOnDrop[user.id];
						saveUser(user.id);
					}
				} else {
					if (user.id in userOnDrop) {
						delete userOnDrop[user.id];
					} else {
						userOnDrop[user.id] = target;
					}
				}
				this.parse(`/pet box show ${target}`);
			},

			clear(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				delete userOnChangeMoves[user.id];
				user.sendTo(room.roomid, `|uhtmlchange|pet-moves-show|`);
				user.sendTo(room.roomid, `|uhtmlchange|pet-box-show|`);
			}

		},

		lawn: {

			'': 'search',
			search(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const bot = Users.get(BOTID);
				loadUser(user.id);
				if (!(user.id in userProperties)) return this.popupReply("您还没有可以战斗的宝可梦哦");
				const wildPokemon = genWildPoke(
					room.roomid,
					Math.max(...userProperties[user.id]['bag'].filter(x => x).map(x => parseInt(x.split('|')[10]) || 100))
				);
				if (!bot || !wildPokemon || inPetModeBattle(user.id) ||
					((user.id in userSearch) && (Date.now() - userSearch[user.id] < LAWNCD))) {
					return this.popupReply('没有发现野生的宝可梦哦');
				}
				userSearch[user.id] = Date.now();
				userOnBattle[user.id] = wildPokemon;
				Rooms.createBattle({
					format: 'gen8petmode',
					p1: {
						user: user,
						team: 'randomPetMode',
						rating: 0,
						hidden: true,
						inviteOnly: false,
					},
					p2: {
						user: bot,
						team: wildPokemon,
						rating: 0,
						hidden: true,
						inviteOnly: false,
					},
					p3: undefined,
					p4: undefined,
					rated: 0,
					challengeType: 'unrated',
					delayedStart: false,
				});
			},
	
			ball(target, room, user) {
				if (!room || !room.battle || !userOnBattle[user.id]) return this.popupReply("请在对战房间里捕捉宝可梦");
				if (!(user.id in userProperties)) return this.popupReply("您没有可以使用的精灵球哦");
				if (inPetModeBattle(user.id) !== room.roomid) return this.popupReply("没有可以捕捉的宝可梦!");
				loadUser(user.id);
				const balls = getAvailableBalls(user.id);
				if (balls.length === 0) return this.popupReply(`您还没有可以使用的精灵球哦`);
				user.sendTo(room.roomid, `|uhtmlchange|pet-ball|`);
				if (target) {
					if (balls.indexOf(target) < 0) return this.popupReply(`您的背包里没有${target}!`);
					userProperties[user.id]['items'][target]--;
					if (userProperties[user.id]['items'][target] === 0) delete userProperties[user.id]['items'][target];
					const species = userOnBattle[user.id].split('|')[1] || userOnBattle[user.id].split('|')[0];
					const maxLevel = Math.max(...userProperties[user.id]['bag'].map(set => {
						return parseInt(set.split('|')[10]) || 100;
					}));
					const foeLevel = parseInt(userOnBattle[user.id].split('|')[10]) || 100;
					if (ifCatchSuccessful(room.battle.turn, target, species, maxLevel / foeLevel)) {
						let type: 'bag' | 'box' = 'bag';
						let index = 0;
						while (userProperties[user.id][type][index]) index++;
						if (index > 5) {
							type = 'box';
							index = 0;
							while (userProperties[user.id][type][index]) index++;
						}
						if (index < 36) {
							addExperience(user.id, foeLevel);
							userProperties[user.id][type][index] = userOnBattle[user.id];
							delete userOnBattle[user.id];
							this.parse('/forfeit');
							saveUser(user.id);
							this.popupReply(`捕获成功! 快进入盒子查看吧!`)
						} else {							
							this.popupReply(`捕获失败!`);
						}
					}
					saveUser(user.id);
				} else {
					user.sendTo(room.roomid, `|uhtml|pet-ball|${balls.map(item => messageButton(
						`/pet lawn ball ${item}`, '', getItemStyle(item)
					)).join('  ')}`);
				}
			},

		},

		shop: {

			'': 'show',
			show(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				if (!(user.id in userProperties)) return this.popupReply("您还未领取最初的伙伴!");
				this.parse('/pet box clear');
				this.parse('/pet shop clear');
				let title = `请选择商品:<br/>${messageButton(`/score pop`, '查看积分')}${messageButton(`/pet box`, '返回')}`;
				if (GOODNAMES.indexOf(target) >= 0) {
					const price = PetModeShopConfig[target] || 50;
					if (price > 0) {
						title = `购买 ${target} ? (${price}积分/1个)<br/>` +
							messageButton(`/pet shop buy ${target}!`, '购买5个!') +
							messageButton(`/pet shop buy ${target}`, '购买1个') +
							messageButton(`/pet shop`, '取消');
					} else {
						title = `领取5个 ${target} ?<br/>${boolButtons(`/pet shop buy ${target}!`, `/pet shop`)}`
					}
				}
				title = `<section style="height: 50px"><strong>${title}</strong></section>`;
				user.sendTo(room.roomid, `|uhtml|pet-shop-show|${title}<section style="height: 250px; overflow: auto">` +
					`${GOODBUTTONS}</section>`);
			},

			async buy(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				if (!(user.id in userProperties)) return this.popupReply("您还未领取最初的伙伴!");
				const targets = target.split('!');
				target = targets[0];
				const times = targets.length > 1 ? 5 : 1;
				if (GOODNAMES.indexOf(target) < 0) return this.popupReply(`没有名为 ${target} 的道具`);
				const price = PetModeShopConfig[target] || 50;
				if (price > 0) {
					const changeScores = await addScore(user.id, -price * times);
					if (changeScores.length !== 2) return this.popupReply(`积分不足!`);
					this.popupReply(`您获得了${times}个 ${target} ! 您现在的积分是: ${changeScores[1]}`);
				} else {
					if (Date.now() - userGetBall[user.id] < BALLCD) {
						return this.popupReply(`您在${Math.floor(BALLCD / 60000)}分钟内已领取过 ${target} !`);
					}
					userGetBall[user.id] = Date.now();
				}
				loadUser(user.id);
				if (!userProperties[user.id]['items'][target]) userProperties[user.id]['items'][target] = 0; 
				userProperties[user.id]['items'][target] = userProperties[user.id]['items'][target] + times;
				saveUser(user.id);
				this.parse('/pet box');
			},

			clear(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				user.sendTo(room.roomid, `|uhtmlchange|pet-shop-show|`);
			}

		},

		edit(target, room, user) {
			this.checkCan('bypassall');
			if (!room) return this.popupReply("请在对战房间里捕捉宝可梦");
			user.sendTo(room.roomid, `|uhtmlchange|pet-edit|`);
			if (!(user.id in userProperties)) return this.popupReply(`您的盒子是空的!`);
			if (target) {
				switch (target.split('!').length) {
					case 2:
						return user.sendTo(room.roomid, `|uhtml|pet-edit|确认删除?  ${boolButtons('/pet edit !!', '/pet edit')}`);
					case 3:
						delete userProperties[user.id];
						removeUser(user.id);
						return this.popupReply(`用户数据已删除`);
					default:
						const property = parseProperty(target);
						if (property) {
							userProperties[user.id] = property;
							saveUser(user.id);
							this.parse('/pet box');
							return this.popupReply(`修改成功!`);
						} else {
							this.popupReply(`格式错误!`);
						}
				}
			}
			user.sendTo(room.roomid, `|uhtml|pet-edit|您的盒子:<br/>` + 
				`<input type="text" style="width: 100%" value='${JSON.stringify(userProperties[user.id])}'/>` +
				`修改盒子: /pet edit {"bag":["宝可梦1",...],"box":["宝可梦2",...],"items":{"道具1":数量1,...}}<br/>` +
				messageButton('/pet edit !', '删除用户数据')
			);
		},

		'': 'help',
		help(target, room, user) {
			if (!room) return this.popupReply("请在房间里使用宠物系统");
			user.sendTo(room.roomid, `|uhtmlchange|pet-welcome|`);
			user.sendTo(
				room.roomid,
				`|uhtml|pet-welcome|<strong>欢迎来到Pokemon Showdown China宠物系统!</strong><br/>` + 
				`${messageButton('/pet init', '领取最初的伙伴!')}  ` + 
				`${messageButton('/pet lawn', '寻找野生的宝可梦!')}  ` +
				`${messageButton('/pet box', '盒子')}  ` +
				`${messageButton('/pet shop', '商店')}`
			);
		}

	}

}
