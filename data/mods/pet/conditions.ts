export const Conditions: {[k: string]: ConditionData} = {
	acidrain: {
		name: 'Acid Rain',
		effectType: 'Weather',
		duration: 0,
		onModifyMove(move, target) {
			if (!move.ignoreImmunity) move.ignoreImmunity = {};
			if (move.ignoreImmunity !== true) {
				move.ignoreImmunity['Steel'] = true;
				move.ignoreImmunity['Poison'] = true;
			}
		},
		onWeatherModifyDamage(relayVar: number, source: Pokemon, target: Pokemon, move) {
			if (move.type === 'Poison' || (source.species.name === 'Crobat' && move.name === 'Super Fang')) {
				if(target.status === ''){
					target.setStatus('tox', source, move, true);
				}
				this.debug('Sunny Day fire boost');
				return this.chainModify(1.5);
			}
			if (move.type === 'Psychic') {
				this.debug('Sunny Day water suppress');
				return this.chainModify(0.5);
			}
		},
		
		// onWeatherModifyDamage(damage, attacker, defender, move, pokemon, source) {
		// 	if (move.type === 'Poison') {
		// 		if(defender.status === ''){
		// 			defender.setStatus('tox', source, move, true);
		// 		}
		// 		this.debug('Sunny Day fire boost');
		// 		return this.chainModify(1.5);
		// 	}
		// 	if (move.type === 'Psychic') {
		// 		this.debug('Sunny Day water suppress');
		// 		return this.chainModify(0.5);
		// 	}
		// },
		onFieldStart(battle, source, effect) {
			if (effect?.effectType === 'Ability') {
				this.add('-weather', 'AcidRain', '[from] ability: ' + effect, '[of] ' + source);
			} else {
				this.add('-weather', 'AcidRain');
			}
			this.add('-message', 'Acid Rain began to fall.');
		},
		onFieldResidualOrder: 1,
		onFieldResidual() {
			this.add('-weather', 'AcidRain', '[upkeep]');
			if (this.field.isWeather('acidrain')) this.eachEvent('Weather');
		},
		onWeather(target) {
			if (!target.hasType('Poison')) {
				this.damage(target.baseMaxhp / 8);
				this.add('-message', 'The Acid Rain hurt the Pokemon.');
			}
		},
		onFieldEnd() {
			this.add('-weather', 'none');
			this.add('-message', 'The Acid Rain subsided.');
		},
	},
};