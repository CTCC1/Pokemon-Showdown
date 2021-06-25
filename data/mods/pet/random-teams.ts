import {FS} from '../../../lib';
import {Teams} from '../../../sim/teams'
import {RandomTeams} from '../../random-teams';

const USERPATH = 'config/pet-mode/user-properties';

function getUserTeam(userid: string): PokemonSet[] | null {
	const userPropertyString = FS(`${USERPATH}/${userid}.json`).readIfExistsSync();
	if (userPropertyString) {
		let userDefaultTeam = JSON.parse(userPropertyString)['bag'].filter((x: string) => x);
		if (userDefaultTeam.length > 0) {
			return Teams.unpack(userDefaultTeam.join(']'));
		}
	}
	return Teams.unpack('Magikarp|||SwiftSwim|Splash|Hardy||M|0,0,0,0,0,0||5|');
}

export class RandomPSChinaPetModeTeams extends RandomTeams {

	randomPetModeTeam(options: PlayerOptions) {
		return getUserTeam(Dex.toID(options.name));
	}

}

export default RandomPSChinaPetModeTeams;