import {FS} from '../../../lib';
import {Teams} from '../../../sim/teams'
import {RandomTeams} from '../../random-teams';

import { PetModeLearnSets } from "../../../config/pet-mode/learnsets";

const USERPATH = 'config/pet-mode/user-properties';
const LEARNSETS: {[speciesid: string]: {[moveid: string]: number}} = PetModeLearnSets;

function getUserTeam(userid: string): PokemonSet[] | null {
	const userPropertyString = FS(`${USERPATH}/${userid}.json`).readIfExistsSync();
	if (userPropertyString) {
		let parsedTeam: PokemonSet[] = [];
		JSON.parse(userPropertyString)['bag'].forEach((x: string) => {
			const team = Teams.unpack(x);
			if (team) {
				const set: PokemonSet = team[0];
				set.moves = set.moves.filter((move: string) => {
					const moveid = Dex.toID(move);
					if (moveid === 'vcreate') return true;
					const minLevel = LEARNSETS[Dex.toID(set.species)][moveid];
					return minLevel !== undefined && set.level >= minLevel;
				});
				if (set.moves.length > 0) parsedTeam.push(set);
			}
		});
		if (parsedTeam.length > 0) return parsedTeam;
	}
	return Teams.unpack('Magikarp|||SwiftSwim|Splash|Hardy||M|0,0,0,0,0,0||5|');
}

export class RandomPSChinaPetModeTeams extends RandomTeams {

	randomPetModeTeam(options: PlayerOptions) {
		return getUserTeam(Dex.toID(options.name));
	}

}

export default RandomPSChinaPetModeTeams;