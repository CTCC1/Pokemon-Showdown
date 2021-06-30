export const Moves: {[k: string]: ModdedMoveData} = {	
	steelterrain: {
		accuracy: true,
		basePower: 0,
		category: "Status",
		desc: "5回合内, 场上所有宝可梦受到效果拔群的招式伤害*0.75, 无法使用回复技能",
		shortDesc: "5回合过滤+回复封印",
		name: "Steel Terrain",
		gen: 8,
		pp: 10,
		priority: 0,
		flags: {},
		terrain: 'steelterrain',
		condition: {
			duration: 5,
			durationCallback(source, effect) {
				if (source?.hasItem('terrainextender')) {
					return 8;
				}
				return 5;
			},
			onFieldStart(field, source, effect) {
				if (effect && effect.effectType === 'Ability') {
						this.add('-fieldstart', 'move: Steel Terrain', '[from] ability: ' + effect, '[of] ' + source);
					} else {
						this.add('-fieldstart', 'move: Steel Terrain');
					}
					this.add('-message', 'The battlefield was covered in Steel!');
			},
			onDamage(damage, source, target, move) {
				if (source.getMoveHitData(move as ActiveMove).typeMod > 0) {
					this.debug('Filter neutralize');
					return this.chainModify(0.75);
				}
			},
			onBeforeMove(pokemon, target, move) {
				if (move.flags['heal'] && !move.isZ && !move.isMax) {
					this.add('cant', pokemon, 'Steel Terrain', move);
					return false;
				}
			},
			onFieldResidualOrder: 21,
			onFieldResidualSubOrder: 3,
			onFieldEnd() {
				this.add('-fieldend', 'move: Steel Terrain');
				this.add('-message', 'The battlefield is no longer covered in Steel.');
			},
		},
		secondary: null,
		target: "all",
		type: "Steel",
	},
}