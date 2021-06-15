/******************************
* Icons for Pokemon Showdown  *
* Credits: Lord Haji, panpawn.*
*******************************/
import {FS} from '../../lib';
let https = require("https");

let icons = FS("config/icons.json").readIfExistsSync();

if (icons !== "") {
	icons = JSON.parse(icons);
} else {
	icons = {};
}

function reloadCSS() {
	let req = https.get('https://play.pokemonshowdown.com/customcss.php?server=' + (Config.serverid), () => {});
	req.end();
}

function updateIcons() {
	FS("config/icons.json").writeUpdate(() => (
		JSON.stringify(icons)
	));

	let newCss = "/* ICONS START */\n";

	for (let name in icons) {
		newCss += generateCSS(name, icons[name]);
	}
	newCss += "/* ICONS END */\n";

	let file = FS("config/custom.css").readIfExistsSync().split("\n");
	if (~file.indexOf("/* ICONS START */")) file.splice(file.indexOf("/* ICONS START */"), (file.indexOf("/* ICONS END */") - file.indexOf("/* ICONS START */")) + 1);
	FS("config/custom.css").writeUpdate(() => (
		file.join("\n") + newCss
	));
	reloadCSS();
}

function generateCSS(name: string, icon: string) {
	let css = "";
	name = toID(name);
	css = `[id$="-userlist-user-${name}"] {\nbackground: url("${icon}") no-repeat right\n}\n`;
	return css;
}

export const commands: Chat.ChatCommands = {
	uli: "icon",
	userlisticon: "icon",
	customicon: "icon",
	icon: {
		set(target, room, user) {
			this.checkCan("bypassall");
			let targets = target.split(",");
			for (let u in targets) targets[u] = targets[u].trim();
			if (targets.length !== 2) return this.parse("/iconhelp");
			const targetName = toID(targets[0]);
			if (targetName.length > 19) return this.errorReply("Usernames are not this long...");

			let iconLink = targets[1];
			const species = Dex.species.get(iconLink);
			if (species.num > 0) {
				iconLink = `http://47.94.147.145:8000/avatars/icons/icon${("00" + species.num).slice(-3)}.gif`;
			} else if (parseInt(iconLink.substr(0, 3))) {
				iconLink = `http://47.94.147.145:8000/avatars/icons/icon${iconLink}.gif`;
			}

			if (icons[targetName]) return this.errorReply("This user already has a custom userlist icon.  Do /icon delete [user] and then set their new icon.");
			this.sendReply(`|raw|You have given ${targets[0]} an icon.`);
			Monitor.log(`${targets[0]} has received an icon from ${user.name}.`);
			this.sendReplyBox(`${targets[0]} has received icon: <img src="${iconLink}" width="32" height="32"> from ${user.name}.`);
			this.modlog("ICON", targets[0], `Set icon to ${iconLink}`);
			icons[targetName] = iconLink;
			updateIcons();
		},

		remove: "delete",
		delete(target, room, user) {
			this.checkCan("bypassall");
			const targetName = toID(target);
			if (!icons[targetName]) return this.errorReply(`/icon - ${targetName} does not have an icon.`);
			delete icons[targetName];
			updateIcons();
			this.sendReply(`You removed ${targetName}'s icon.`);
			Monitor.log(`${user.name} removed ${targetName}'s icon.`);
			this.sendReplyBox(`${targetName}'s icon was removed by ${user.name}.`);
			this.modlog("ICON", targetName, `Removed icon`);
		},

		list: "show",
		used: "show",
		show(target, room, user) {
			this.parse("/showicons");
		},

		users: "table",
		details: "table",
		assignment: "table",
		table(target, room, user) {
			this.parse("/showicons details");
		},

		"": "help",
		help(target, room, user) {
			this.parse("/iconhelp");
		},
	},

	icons: "showicons",
	unavailableicons: "showicons",
	showicon: "showicons",
	showicons(target, room, user) {
		if (toID(target).indexOf("detail") > -1 || toID(target).indexOf("table") > -1 ) {
			const iconTable = `<table>${Object.entries(icons).map(
				([k, v], e) => `<tr><td>${k}</td><td><img src="${v}" width=32 height=32></td></tr>`
			).join('')}</table>`;
			this.sendReplyBox(`<details><summary><strong>Users with Icons</strong></summary>${iconTable}</details>`);
		} else {
			const iconList = Array.from(new Set(Object.values(icons).sort())).map(
				x => `<img src="${x}" width=32 height=32>`
			).join('');	
			this.sendReplyBox(`<details><summary><strong>Already Used Icons</strong></summary>${iconList}</details>`);
		}
	},

	iconhelp: [
		"Commands Include:",
		"/icon set [user], [species / number / image url] - Gives [user] an icon (require: &)",
		"/icon delete [user] - Deletes [user]'s icon (require: &)",
		"/icon list - Show all icons already used",
		"/icon table - Show all users with icons",
	],
};