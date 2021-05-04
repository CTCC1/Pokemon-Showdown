import {RandomTeams} from '../../random-teams';
import {FS} from '../../../lib';

export class RandomPSChinaForFunTeams extends RandomTeams {
	randomDurantsTeam() {
		const pokemon = [];
		let names = FS('config/durant-names.txt').readSync('utf8').split(',');
		const species = this.dex.species.get('Durant');
		while (pokemon.length < 6) {
			const set = {
				name: this.sample(names),
				species: species.name,
				gender: species.gender,
				item: this.random(2) < 1 ? 'Choice Scarf' : 'Leppa Berry',
				ability: 'Hustle',
				shiny: false,
				evs: {hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252},
				nature: 'Jolly',
				ivs: {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31},
				moves: ['Guillotine'],
			};
			if (this.random(4) < 1) {
				set.moves.push('Spite');
			} else if (this.random(6) < 1) {
				set.ability = 'Cursed Body';
			} else if (this.random(8) < 1) {
				set.moves.push('Superpower');
			} else if (this.random(10) < 1) {
				set.moves.push('Foresight');
				set.item = 'Bright Powder'
			} else if (this.random(12) < 1) {
				set.item = 'Focus Sash';
			} else if (this.random(14) < 1) {
				set.moves.push('Assist');
				set.ability = ('Prankster');
			} else if (this.random(16) < 1) {
				set.moves.push('Dynamic Punch');
			} else if (this.random(18) < 1) {
				set.item = 'Leppa Berry';
				set.moves.push('Imprison');
			}
			pokemon.push(set);
		}
		pokemon[0].shiny = true;
		if (this.random(4) < 1) {
			pokemon[0].moves.push('Inferno');
			pokemon[0].ability = 'Truant';
		} else {
			pokemon[0].item = 'Watmel Berry';
			pokemon[0].moves.push('Natural Gift');
		}
		return pokemon;
	}
	randomMetronomeTeam() {
		let team = this.randomCCTeam();
		for (let pokemon of team) {
			pokemon.moves = ['Metronome'];
		}
		return team;
	}
}

export default RandomPSChinaForFunTeams;