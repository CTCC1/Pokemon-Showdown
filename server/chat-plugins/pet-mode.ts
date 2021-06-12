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
import { PokemonIconIndexes } from "./poke-num";

type pokeList = string[];
type itemList = { [itemName: string]: number };
type userProperty = { 'bag': pokeList, 'box': pokeList, 'items': itemList };
type pokePosition = { 'type': 'bag' | 'box', 'index': number };

const prng = new PRNG();
const ROOMPATH = 'config/pet-mode/room-config.json';
const USERPATH = 'config/pet-mode/user-properties';
const POKESHEET = 'https://play.pokemonshowdown.com/sprites/pokemonicons-sheet.png';
const POKESPRITES = 'https://play.pokemonshowdown.com/sprites/ani';
const ITEMSHEET = 'https://play.pokemonshowdown.com/sprites/itemicons-sheet.png';

let userOnEx: { [userid: string]: string } = {};
let userOnDrop: { [userid: string]: string } = {};
let userLookAt: { [userid: string]: string } = {};
let userEvoStage: { [userid: string]: string | false } = {};
let userProperties: { [userid: string]: userProperty } = {};
let userOnChangeMoves: { [userid: string]: { 'position': pokePosition, 'selected': string[], 'valid': string[] } } = {};
FS(USERPATH).readdirSync().forEach(x => userProperties[x.split('.')[0]] = JSON.parse(FS(`${USERPATH}/${x}`).readIfExistsSync()));

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
		return `height: 32px;width: 40px;`
	}
	let top = Math.floor(num / 12) * 30;
	let left = (num % 12) * 40;
	return `background: transparent url(${POKESHEET}?v5) no-repeat scroll -${left}px -${top}px; height: 32px; width: 40px;`;
}

function MessageButton(style: string, message: string, desc: string, highlight: boolean = false) {
	const HLStyle = highlight ? 'border-radius: 10px;' : '';
	return `<button style="${style} ${HLStyle}" class="button" name="send" value="${message}">${desc}</button>`
}

function BoolButtons(yesMessage: string, noMessage: string) {
	return MessageButton('', yesMessage, '确认') + MessageButton('', noMessage, '取消');
}

const INITMONBUTTONS = [
	'Bulbasaur', 'Chikorita', 'Treecko', 'Turtwig', 'Snivy', 'Chespin', 'Rowlet', 'Grookey', '<br/>',
	'Charmander', 'Cyndaquil', 'Torchic', 'Chimchar', 'Tepig', 'Fennekin', 'Litten', 'Scorbunny', '<br/>',
	'Squirtle', 'Totodile', 'Mudkip', 'Piplup', 'Oshawott', 'Froakie', 'Popplio', 'Sobble',
].map(x => {
	return x === '<br/>' ? x : MessageButton(getIconStyle(x), `/pet init set ${x}`, '');
}).join('');

function randomEvs(): StatsTable {
	let intArray = [...new Array(32).keys()];
	return {hp: prng.sample(intArray), atk: prng.sample(intArray), def: prng.sample(intArray),
		spa: prng.sample(intArray), spd: prng.sample(intArray), spe: prng.sample(intArray)};
}

function initUserProperty(): userProperty {
	return {'bag': new Array(6).fill(''), 'box': new Array(30).fill(''), 'items': {}}
}

function saveUser(userid: string) {
	FS(`${USERPATH}/${userid}.json`).writeSync(JSON.stringify(userProperties[userid]));
}

function completeSet(set: PokemonSet): PokemonSet {
	const species = Dex.species.get(set.name);
	if (!set.ability) set.ability = species.abilities["0"];
	if (!set.evs) set.evs = {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0};
	if (!set.ivs) set.ivs = {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31};
	if (!set.shiny) set.shiny = false;
	return set;
}

function getValidMoves(species: string, level: number): string[] {
	const moves = Dex.data.Learnsets[species].learnset;
	if (!moves) return [];
	return Object.keys(moves);
	// let validMoves = [];
	// for (let move in moves) {
	// 	for (let condition of moves[move]) {
	// 		if (condition.indexOf('L') < 0 || parseInt(condition.split('L')[1]) <= level) {
	// 			validMoves.push(move);
	// 			break;
	// 		}
	// 	}
	// }
	// return validMoves;
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
	const sets = Teams.unpack(userProperties[userid][pos['type']][pos['index']]);
	if (!sets) return null;
	return completeSet(sets[0]);
}

function exchangeSet(target1: string, target2: string, userid: string): boolean | null {
	const pos1 = parsePosition(target1);
	const pos2 = parsePosition(target2);
	if (!pos1 || !pos2) return null;
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

function getAvailableEvos(speciesid: string, level: number): string[] {
	return Dex.species.get(speciesid).evos.filter(x => level >= (Dex.species.get(x).evoLevel || 0));	
}


export const commands: Chat.ChatCommands = {

	'petmode': 'pet',
	pet: {

		init: {

			'': 'show',
			show(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				if (user.id in userProperties) return this.popupReply("您已领取最初的伙伴！请输入/pet box查看盒子");
				user.sendTo(room.roomid, `|uhtml|pet-init-show|欢迎使用宠物系统！请选择您最初的伙伴：<br/>${INITMONBUTTONS}`);
			},

			set(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				if (user.id in userProperties) return this.popupReply("您已领取最初的伙伴！请输入/pet box查看盒子");
				user.sendTo(room.roomid, `|uhtml|pet-init-choose|确认选择<div style="${getIconStyle(target)}"></div>作为您最初的伙伴？${
					BoolButtons(`/pet init confirm ${target}`, '/pet init clear')
				}`);
			},

			confirm(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				if (user.id in userProperties) return this.popupReply("您已领取最初的伙伴！请输入/pet box查看盒子");
				const species = Dex.species.get(target);
				if (species.num <= 0) {
					return this.popupReply(`${target}不是合法的宝可梦`)
				}
				const set: PokemonSet = {
					name: species.name,
					species: species.name,
					item: "",
					ability: species.abilities["0"],
					moves: genRandomMoves(species.id, 5),
					nature: prng.sample(Dex.natures.all()).name,
					gender: prng.randomChance(Math.floor(species.genderRatio.M * 1000), 1000) ? 'M' : 'F',
					evs: {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0},
					ivs: randomEvs(),
					level: 5,
					happiness: 70,
					shiny: prng.randomChance(1, 256),
				};
				userProperties[user.id] = initUserProperty();
				userProperties[user.id]['bag'][0] = Teams.pack([set]);
				saveUser(user.id);
				this.parse('/pet init clear');
				user.sendTo(room.roomid, `|uhtml|pet-init-confirm|您获得了：<div style="${
					getIconStyle(target)
				}"></div>快进入 ${
					MessageButton('', '/pet box show', '盒子')
				} 查看吧！`);
			},

			clear(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				user.sendTo(room.roomid, `|uhtmlchange|pet-init-choose|`);
				user.sendTo(room.roomid, `|uhtmlchange|pet-init-confirm|`);
			}

		},

		box: {

			'': 'show',
			show(target, room, user) {
				delete userLookAt[user.id];
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				if (!(user.id in userProperties)) return this.popupReply("您还未领取最初的伙伴！");
				this.parse('/pet init clear');

				let pokeDiv = ``;
				if (target) {
					const position = parsePosition(target);
					if (!position) return this.popupReply('位置不存在！');
					const set = parseSet(position, user.id);
					if (!set) return this.parse('/pet box show');
					userLookAt[user.id] = target.split(' ').join('');
					const lineStyle = "display: inline-block; vertical-align: middle; width: 100%; height: 30px; line-height: 30px;";
					const st = (x: string) => `<strong>${x}</strong>`;
					let exButton = MessageButton('', `/pet box onex ${target}`, '移动');
					if (user.id in userOnEx) exButton = st('请选择位置');
					let evoButton = MessageButton('', `/pet box evo ${target}`, '进化');
					if (user.id in userEvoStage) {
						if (userEvoStage[user.id]) {
							evoButton = st('确认进化? ') +
								BoolButtons(`/pet box evo ${target}=>${userEvoStage[user.id]}`, `/pet box evo ${target}`);
						} else {
							evoButton = st('请选择进化型: ') + getAvailableEvos(set.species, set.level).map(x => {
								return MessageButton(getIconStyle(x), `/pet box evo ${target}=>${x}`, '');
							}).join('');
						}
					}
					let dropButton = MessageButton('', `/pet box drop ${target}`, '放生');
					if (userOnDrop[user.id]) {
						dropButton = `${st('确认放生? ')}${BoolButtons(`/pet box drop ${target}!`, `/pet box drop ${target}`)}`;
					}
					const lines = [
						`${st('昵称')}: ${set.name}  ${st('种类')}: ${set.species}`,
						`${st('性别')}: ${set.gender === 'M' ? '♂' : set.gender === 'F' ? '♀' : '∅'}  ` +
						`${st('亲密度')}: ${set.happiness}  ${exButton}`,
						`${st('等级')}: ${set.level}  ` + 
						`${st('道具')}: ${set.item ? MessageButton(getItemStyle(set.item), `/pet box item ${target}`, '') : '无道具'}`,
						`${dropButton}  ${evoButton}`,
						`${st('性格')}: ${set.nature}  ${st('特性')}: ${set.ability}`,
						`${st('个体值')}: ${listStats(set.ivs)}`,
						`${st('努力值')}: ${listStats(set.evs)}`,
						`${st('招式')}: [${set.moves.toString().split(',').join('|')}]  ` +
						`${MessageButton('', `/pet box moves ${target}`, '更改招式')}`
					]
					const spriteURL = `${POKESPRITES}/${toID(set.species)}.gif`;
					const sprite = `background: transparent url(${spriteURL}) no-repeat 70% 10% relative;`
					pokeDiv = `<section style="${sprite} position: relative; display: inline-block; vertical-align: top;` +
						`width: 350px; height: '100%';">${lines.map(x => `<div style="${lineStyle}">${x}</div>`).join('')}` + 
						`</section>`.split('\n').join('').split('\t').join('');
				}

				const petButton = (species: string, target: string) => {
					const style = getIconStyle(species);
					if (user.id in userOnEx) return MessageButton(style, `/pet box ex ${userOnEx[user.id]}<=>${target}`, '');
					return MessageButton(style, `/pet box show ${target}`, '', userLookAt[user.id] === target.split(' ').join(''));
				};
				const bagMons = userProperties[user.id]['bag'].map((x, i) =>
					petButton(x.split('|')[1] || x.split('|')[0], `bag,${i}`)).join('') + '<br/>';
				const boxMons = userProperties[user.id]['box'].map((x, i) =>
					petButton(x.split('|')[1] || x.split('|')[0], `box,${i}`) + (i % 6 == 5 ? '<br/>' : '')).join('');
				let Items = ``;
				// let itemButton = (item: string) => getImage(getItemStyle(item));
				// if (user.id in userLookAt) {
				// 	itemButton = (item: string) => MessageButton(getItemStyle(item), `/pet box item ${target}=>${item}`, '');
				// }
				const itemButton = (item: string) => MessageButton(
					getItemStyle(item), (user.id in userLookAt) ? `/pet box item ${target}=>${item}` : '', ''
				);
				for (let itemName in userProperties[user.id]['items']) {
					Items += `${itemButton(itemName)}x${userProperties[user.id]['items'][itemName]} `;
				}
				let boxDiv = `<section style="position: relative; vertical-align: top; display: inline-block; width: 250px; ` +
					`height: '100%';"><strong>背包<br/>${bagMons}盒子<br/>${boxMons}${Items ? '道具</strong><br/>' : ''}${Items}</section>`;

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
				if (result === null) return this.popupReply(`位置不存在！`);
				if (result === false) return this.popupReply(`背包不能为空！`);
				this.parse(`/pet box show ${targets[1]}`);
			},

			evo(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				// [进化]: userEvoStage <- false, /pet box show = 希望的进化型(/pet box evo target=>goal)
				// [选择进化型]: userEcoStarge <- goal, /pet box show = 确认(/pet box evo target=>goal) | 取消(/pet box evo target)
				// [确认]: delete userEcoStarge, /pet box show = 进化(/pet box evo target)
				const targets = target.split('=>').map(x => x.trim());
				target = targets[0];
				const position = parsePosition(target);
				if (!position) return this.popupReply('位置不存在！');
				const set = parseSet(position, user.id);
				if (!set) return this.popupReply('位置是空的！');
				const availableEvos = getAvailableEvos(set.species, set.level);
				if (availableEvos.length === 0) {
					return this.popupReply('不满足进化条件！');
				}
				if (user.id in userEvoStage) {
					if (targets.length !== 2) {
						delete userEvoStage[user.id];
					} else {
						if (userEvoStage[user.id]) {
							if (availableEvos.indexOf(targets[1]) < 0) return this.popupReply('进化型不合法！');
							if (set.species === set.name) set.name = targets[1];
							set.species = targets[1];
							userProperties[user.id][position['type']][position['index']] = Teams.pack([set]);
							saveUser(user.id);
							delete userEvoStage[user.id];
							this.popupReply('进化成功！');
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
				if (!position) return this.popupReply('位置不存在！');
				const set = parseSet(position, user.id);
				if (!set) return this.popupReply('位置是空的！');

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
				if (!position) return this.popupReply('位置不存在！');
				const set = parseSet(position, user.id);
				if (!set) return this.popupReply('位置是空的！');
				if (!(user.id in userOnChangeMoves)) {
					userOnChangeMoves[user.id] = {
						'position': position,
						'selected': [],
						'valid': getValidMoves(toID(set.species), set.level).map(x => Dex.moves.get(x).name)
					};
				}
				const section = (x: string) =>
					`<section style="display: inline-block; position: relative; width: 160px;` +
					` height: 150px; overflow: auto; vertical-align: top;">${x}</section>`;
				const valid = userOnChangeMoves[user.id]['valid'].map(move =>
					MessageButton('width: 140px;', `/pet box addmove ${target}=>${move}`, move)
				).join('<br/>');
				const selected = userOnChangeMoves[user.id]['selected'].map(move =>
					MessageButton('width: 140px;', `/pet box addmove ${target}=>${move}`, move)
				).join('<br/>');
				const buttons = BoolButtons(`/pet box setmoves ${target}!`, `/pet box setmoves ${target}`);
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
				target = targets[0];
				if (targets.length === 2 && userOnChangeMoves[user.id] && userOnChangeMoves[user.id]['selected'].length > 0) {
					const position = parsePosition(target);
					if (!position) return this.popupReply('位置不存在！');
					const set = parseSet(position, user.id);
					if (!set) return this.popupReply('位置是空的！');
					set.moves = userOnChangeMoves[user.id]['selected'];
					userProperties[user.id][position['type']][position['index']] = Teams.pack([set]);
					saveUser(user.id);
				}
				delete userOnChangeMoves[user.id];
				this.parse(`/pet box show ${target}`);
				user.sendTo(room.roomid, `|uhtmlchange|pet-moves-show|`);
			},

			drop(target, room, user) {
				if (!room) return this.popupReply("请在房间里使用宠物系统");
				const targets = target.split('!').map(x => x.trim());
				target = targets[0];
				const position = parsePosition(target);
				if (!position) return this.popupReply('位置不存在！');
				const set = parseSet(position, user.id);
				if (!set) return this.popupReply('位置是空的！');
				if (user.id in userOnDrop && target === userOnDrop[user.id] && targets.length === 2) {
					if (position['type'] === 'bag' && userProperties[user.id]['bag'].filter(x => x).length <= 1) {
						delete userOnDrop[user.id];
						this.popupReply('背包不能为空！');
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
				user.sendTo(room.roomid, `|uhtmlchange|pet-box-show|`);
			}

		},

		ballbattle(target, room, user) {
			// 如果没有用户数据或空背包: 一只5级鲤鱼王
			const bot = Users.get('pschinabot');
			if (!bot) return this.popupReply('没有发现野生的宝可梦哦');
			Rooms.createBattle({
				format: 'gen8randombattle',
				p1: {
					user: user,
					team: 'random',
					rating: 0,
					hidden: true,
					inviteOnly: false,
				},
				p2: {
					user: bot,
					team: 'random',
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

		'': 'help',
		help(target, room, user) {
			if (!room) return this.popupReply("请在房间里使用宠物系统");
			user.sendTo(room.roomid, `|uhtmlchange|pet-welcome|`);
			user.sendTo(room.roomid, `|uhtml|pet-welcome|<strong>欢迎来到Pokemon Showdown China宠物系统！</strong><br/>` + 
				`${MessageButton('', '/pet init', '领取最初的伙伴！')}  ${MessageButton('', '/pet box', '查看盒子')}`);
		}

	}

}