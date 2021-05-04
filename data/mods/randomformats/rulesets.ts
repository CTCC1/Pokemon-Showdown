export const Rulesets: {[k: string]: ModdedFormatData} = {
	randomformats: {
		effectType: 'Rule',
		name: 'Random Formats',
		desc: "参照 Gen1~Gen6 UB~LC 各分级具体规则",
		
		onBegin() {
			let realMod = this.format.name.substr(0, 4);
			if (realMod === 'gen5' || realMod === 'gen6' || realMod === 'gen7') {
				this.add('clearpoke');
				for (const pokemon of this.getAllPokemon()) {
					let details = pokemon.details.replace(/(Arceus|Gourgeist|Genesect|Pumpkaboo|Silvally)(-[a-zA-Z?]+)?/g, '$1-*').replace(', shiny', '');
					this.add('poke', pokemon.side.id, details, pokemon.item ? 'item' : '');
				}
				this.add('rule', 'Mega Rayquaza Clause: You cannot mega evolve Rayquaza');
				for (const pokemon of this.getAllPokemon()) {
					if (pokemon.species.id === 'rayquaza') pokemon.canMegaEvo = null;
				}
			}
			if (realMod === 'gen1' || realMod === 'gen2') {
				this.add('rule', 'Freeze Clause Mod: Limit one foe frozen');
			}
			this.add('html', `<div class="broadcast-green"><strong>CURRENT FORMAT: ` + this.format.name + ` </strong></div>`);
		},
		onFieldTeamPreview() {
			let realMod = this.format.name.substr(0, 4);
			if (realMod === 'gen5' || realMod === 'gen6' || realMod === 'gen7') {
				this.makeRequest('teampreview');
			}
		},
		onSetStatus(status, target, source) {
			if (source && source.side === target.side) {
				return;
			}
			let realMod = this.format.name.substr(0, 4);
			if (status.id === 'frz' && (realMod === 'gen1' || realMod === 'gen2')) {
				for (const pokemon of target.side.pokemon) {
					if (pokemon.status === 'frz') {
						this.add('-message', 'Freeze Clause activated.');
						return false;
					}
				}
			}
		},
	},
}