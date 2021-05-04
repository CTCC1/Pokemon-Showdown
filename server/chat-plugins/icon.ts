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
			if (!this.user.can("bypassall")) return this.errorReply("To set icons, you need to be an admin user.");
			let targets = target.split(",");
			for (let u in targets) targets[u] = targets[u].trim();
			if (targets.length !== 2) return this.parse("/help icon");
			const targetName = toID(targets[0]);
			if (targetName.length > 19) return this.errorReply("Usernames are not this long...");
			if (icons[targetName]) return this.errorReply("This user already has a custom userlist icon.  Do /icon delete [user] and then set their new icon.");
			this.sendReply(`|raw|You have given ${targets[0]} an icon.`);
			Monitor.log(`${targets[0]} has received an icon from ${user.name}.`);
			this.privateModAction(`|raw|(${targets[0]} has received icon: <img src="${targets[1]}" width="32" height="32"> from ${user.name}.)`);
			this.modlog("ICON", targets[0], `Set icon to ${target[1]}`);
			icons[targetName] = targets[1];
			updateIcons();
		},

		remove: "delete",
		delete(target, room, user) {
			if (!this.user.can('bypassall')) return this.errorReply("To delete icons, you need to be an admin user.");
			const targetName = toID(target);
			if (!icons[targetName]) return this.errorReply(`/icon - ${targetName} does not have an icon.`);
			delete icons[targetName];
			updateIcons();
			this.sendReply(`You removed ${targetName}'s icon.`);
			Monitor.log(`${user.name} removed ${targetName}'s icon.`);
			this.privateModAction(`(${targetName}'s icon was removed by ${user.name}.)`);
			this.modlog("ICON", targetName, `Removed icon`);
		},

		"": "help",
		help(target, room, user) {
			this.parse("/iconhelp");
		},
	},

	iconhelp: [
		"Commands Include:",
		"/icon set [user], [image url] - Gives [user] an icon of [image url]",
		"/icon delete [user] - Deletes a user's icon",
		"Both commands require: &",
	],
};